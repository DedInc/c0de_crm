import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

const CHANNEL_PREFIX = 'chat:order:';
const DEFAULT_MAX_TOTAL_CONNECTIONS = 1000;
const DEFAULT_MAX_CONNECTIONS_PER_ORDER = 50;

const CLUSTER_TOTAL_KEY = 'crm:sse:cluster:total';
const CLUSTER_ORDER_PREFIX = 'crm:sse:cluster:order:';
const CLUSTER_LEASE_TTL_SECONDS = 60;

// Local SSE connections (per-instance)
const connections = new Map<string, Set<ReadableStreamDefaultController>>();
const controllerLeaseIds = new WeakMap<ReadableStreamDefaultController, string>();
let totalConnectionCount = 0;

// Heartbeat interval to keep connections alive (15 seconds)
export const HEARTBEAT_INTERVAL = 15000;

function getConnectionLimit(name: string, fallback: number): number {
	const parsed = parseInt(env[name] || '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOptionalLimit(name: string): number | null {
	const raw = env[name];
	if (!raw) return null;
	const parsed = parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Redis Pub/Sub clients (subscriber needs a dedicated connection)
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;
const subscribedChannels = new Set<string>();

function getRedisUrl(): string {
	return env.REDIS_URL || 'redis://localhost:6379';
}

function ensureRedisPub(): Redis | null {
	if (env.CACHE_ENABLED !== 'true') return null;
	if (!redisPub) {
		try {
			redisPub = new Redis(getRedisUrl(), { maxRetriesPerRequest: 3, lazyConnect: true });
			redisPub.connect().catch(() => { redisPub = null; });
		} catch {
			return null;
		}
	}
	return redisPub;
}

function ensureRedisSub(): Redis | null {
	if (env.CACHE_ENABLED !== 'true') return null;
	if (!redisSub) {
		try {
			redisSub = new Redis(getRedisUrl(), { maxRetriesPerRequest: 3, lazyConnect: true });
			redisSub.connect().catch(() => { redisSub = null; });
			redisSub.on('message', (channel: string, data: string) => {
				const orderId = channel.slice(CHANNEL_PREFIX.length);
				broadcastToLocal(orderId, data);
			});
		} catch {
			return null;
		}
	}
	return redisSub;
}

function broadcastToLocal(orderId: string, rawData: string) {
	const orderConnections = connections.get(orderId);
	if (!orderConnections) return;

	const sseFrame = `data: ${rawData}\n\n`;
	const encoded = new TextEncoder().encode(sseFrame);
	const dead: ReadableStreamDefaultController[] = [];

	for (const controller of orderConnections) {
		try {
			controller.enqueue(encoded);
		} catch {
			dead.push(controller);
		}
	}

	for (const controller of dead) {
		removeConnection(orderId, controller);
	}
}

export function notifyNewMessage(orderId: string, message: unknown) {
	const payload = JSON.stringify(message);
	const pub = ensureRedisPub();
	if (pub) {
		pub.publish(`${CHANNEL_PREFIX}${orderId}`, payload).catch(() => {
			broadcastToLocal(orderId, payload);
		});
	} else {
		broadcastToLocal(orderId, payload);
	}
}

async function checkClusterCaps(orderId: string): Promise<boolean> {
	const clusterTotalCap = getOptionalLimit('MAX_CHAT_SSE_CLUSTER_TOTAL_CONNECTIONS');
	const clusterPerOrderCap = getOptionalLimit('MAX_CHAT_SSE_CLUSTER_CONNECTIONS_PER_ORDER');
	if (clusterTotalCap === null && clusterPerOrderCap === null) {
		return true;
	}

	const pub = ensureRedisPub();
	if (!pub) return true;

	const now = Date.now();
	const orderKey = `${CLUSTER_ORDER_PREFIX}${orderId}`;

	try {
		await pub
			.pipeline()
			.zremrangebyscore(CLUSTER_TOTAL_KEY, 0, now)
			.zremrangebyscore(orderKey, 0, now)
			.exec();

		if (clusterTotalCap !== null) {
			const total = await pub.zcard(CLUSTER_TOTAL_KEY);
			if (total >= clusterTotalCap) return false;
		}
		if (clusterPerOrderCap !== null) {
			const perOrder = await pub.zcard(orderKey);
			if (perOrder >= clusterPerOrderCap) return false;
		}
	} catch {
		// On Redis failure, fall back to per-process caps only
		return true;
	}
	return true;
}

async function registerClusterLease(orderId: string, leaseId: string): Promise<void> {
	const pub = ensureRedisPub();
	if (!pub) return;
	const expireAt = Date.now() + CLUSTER_LEASE_TTL_SECONDS * 1000;
	const orderKey = `${CLUSTER_ORDER_PREFIX}${orderId}`;
	try {
		await pub
			.pipeline()
			.zadd(CLUSTER_TOTAL_KEY, expireAt.toString(), leaseId)
			.zadd(orderKey, expireAt.toString(), leaseId)
			.expire(orderKey, CLUSTER_LEASE_TTL_SECONDS * 4)
			.exec();
	} catch {
		// Best effort; per-process caps still apply.
	}
}

async function releaseClusterLease(orderId: string, leaseId: string): Promise<void> {
	const pub = ensureRedisPub();
	if (!pub) return;
	const orderKey = `${CLUSTER_ORDER_PREFIX}${orderId}`;
	try {
		await pub
			.pipeline()
			.zrem(CLUSTER_TOTAL_KEY, leaseId)
			.zrem(orderKey, leaseId)
			.exec();
	} catch {
		// Stale entries auto-expire via the score timestamp.
	}
}

export async function refreshClusterLease(
	orderId: string,
	controller: ReadableStreamDefaultController
): Promise<void> {
	const leaseId = controllerLeaseIds.get(controller);
	if (!leaseId) return;
	await registerClusterLease(orderId, leaseId);
}

export async function tryAddConnection(
	orderId: string,
	controller: ReadableStreamDefaultController
): Promise<boolean> {
	const maxTotal = getConnectionLimit('MAX_CHAT_SSE_TOTAL_CONNECTIONS', DEFAULT_MAX_TOTAL_CONNECTIONS);
	const maxPerOrder = getConnectionLimit('MAX_CHAT_SSE_CONNECTIONS_PER_ORDER', DEFAULT_MAX_CONNECTIONS_PER_ORDER);
	const orderConnections = connections.get(orderId);

	if (totalConnectionCount >= maxTotal || (orderConnections?.size ?? 0) >= maxPerOrder) {
		return false;
	}

	if (!(await checkClusterCaps(orderId))) {
		return false;
	}

	if (!connections.has(orderId)) {
		connections.set(orderId, new Set());
	}
	connections.get(orderId)!.add(controller);
	totalConnectionCount++;

	const leaseId = crypto.randomUUID();
	controllerLeaseIds.set(controller, leaseId);
	await registerClusterLease(orderId, leaseId);

	const channel = `${CHANNEL_PREFIX}${orderId}`;
	if (!subscribedChannels.has(channel)) {
		const sub = ensureRedisSub();
		if (sub) {
			sub.subscribe(channel).catch(() => {});
			subscribedChannels.add(channel);
		}
	}
	return true;
}

export function removeConnection(orderId: string, controller: ReadableStreamDefaultController) {
	const orderConnections = connections.get(orderId);
	if (orderConnections) {
		const deleted = orderConnections.delete(controller);
		if (deleted) {
			totalConnectionCount = Math.max(totalConnectionCount - 1, 0);
		}
		const leaseId = controllerLeaseIds.get(controller);
		if (leaseId) {
			controllerLeaseIds.delete(controller);
			void releaseClusterLease(orderId, leaseId);
		}
		if (orderConnections.size === 0) {
			connections.delete(orderId);
			const channel = `${CHANNEL_PREFIX}${orderId}`;
			const sub = ensureRedisSub();
			if (sub && subscribedChannels.has(channel)) {
				sub.unsubscribe(channel).catch(() => {});
				subscribedChannels.delete(channel);
			}
		}
	}
}
