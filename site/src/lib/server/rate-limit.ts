import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

let rateLimitClient: Redis | null = null;

function failClosed(windowSeconds: number): RateLimitResult {
	return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
}

function unavailableResult(
	maxAttempts: number,
	windowSeconds: number,
	failClosedEnv = 'LOGIN_RATE_LIMIT_FAIL_CLOSED'
): RateLimitResult {
	if (env[failClosedEnv] === 'false') {
		return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
	}
	return failClosed(windowSeconds);
}

function getClient(): Redis | null {
	if (!env.REDIS_URL) return null;

	if (rateLimitClient) return rateLimitClient;

	try {
		rateLimitClient = new Redis(env.REDIS_URL, {
			maxRetriesPerRequest: 1,
			connectTimeout: 5000,
			commandTimeout: 3000,
			lazyConnect: true,
			enableOfflineQueue: false
		});

		rateLimitClient.on('error', () => {
			rateLimitClient = null;
		});

		rateLimitClient.connect().catch(() => {
			rateLimitClient = null;
		});

		return rateLimitClient;
	} catch {
		return null;
	}
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter backed by Redis.
 */
export async function checkRateLimit(
	key: string,
	maxAttempts: number,
	windowSeconds: number,
	options?: { failClosedEnv?: string }
): Promise<RateLimitResult> {
	const client = getClient();
	if (!client) {
		return unavailableResult(maxAttempts, windowSeconds, options?.failClosedEnv);
	}

	const redisKey = `ratelimit:${key}`;
	const now = Date.now();
	const windowMs = windowSeconds * 1000;

	try {
		const pipeline = client.pipeline();
		pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
		pipeline.zcard(redisKey);
		pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random()}`);
		pipeline.expire(redisKey, windowSeconds);

		const results = await pipeline.exec();
		if (!results) {
			return unavailableResult(maxAttempts, windowSeconds, options?.failClosedEnv);
		}

		const currentCount = (results[1]?.[1] as number) ?? 0;

		if (currentCount >= maxAttempts) {
			// Remove the entry we just added since the request is denied
			await client.zremrangebyscore(redisKey, now, now + 1);

			const oldest = await client.zrange(redisKey, 0, 0, 'WITHSCORES');
			const oldestTimestamp = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
			const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

			return {
				allowed: false,
				remaining: 0,
				retryAfterSeconds: Math.max(retryAfterSeconds, 1)
			};
		}

		return {
			allowed: true,
			remaining: maxAttempts - currentCount - 1,
			retryAfterSeconds: 0
		};
	} catch {
		return unavailableResult(maxAttempts, windowSeconds, options?.failClosedEnv);
	}
}
