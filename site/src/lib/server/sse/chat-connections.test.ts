import { beforeEach, describe, expect, it, vi } from 'vitest';

const envState = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => envState);

const ioredisMocks = vi.hoisted(() => {
	const pipelineState = {
		execResult: [] as unknown[]
	};

	function createPipeline() {
		const chain: Record<string, unknown> = {};
		chain.zremrangebyscore = vi.fn(() => chain);
		chain.zadd = vi.fn(() => chain);
		chain.zrem = vi.fn(() => chain);
		chain.expire = vi.fn(() => chain);
		chain.exec = vi.fn(() => Promise.resolve(pipelineState.execResult));
		return chain;
	}

	const instance = {
		connect: vi.fn(() => Promise.resolve()),
		on: vi.fn(),
		publish: vi.fn(() => Promise.resolve(0)),
		subscribe: vi.fn(() => Promise.resolve()),
		unsubscribe: vi.fn(() => Promise.resolve()),
		zcard: vi.fn(() => Promise.resolve(0)),
		pipeline: vi.fn(createPipeline)
	};

	return { instance, pipelineState };
});

vi.mock('ioredis', () => ({
	default: vi.fn(function () {
		return ioredisMocks.instance;
	})
}));

async function loadFreshModule() {
	vi.resetModules();
	return await import('./chat-connections');
}

function setEnv(values: Record<string, string | undefined>) {
	for (const k of Object.keys(envState.env)) delete envState.env[k];
	Object.assign(envState.env, values);
}

describe('chat-connections per-process caps', () => {
	beforeEach(() => {
		setEnv({ CACHE_ENABLED: 'false' });
		ioredisMocks.instance.zcard.mockReset();
		ioredisMocks.instance.zcard.mockResolvedValue(0);
	});

	it('rejects connections beyond MAX_CHAT_SSE_TOTAL_CONNECTIONS', async () => {
		setEnv({
			CACHE_ENABLED: 'false',
			MAX_CHAT_SSE_TOTAL_CONNECTIONS: '1',
			MAX_CHAT_SSE_CONNECTIONS_PER_ORDER: '5'
		});
		const { tryAddConnection, removeConnection } = await loadFreshModule();
		const c1 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;
		const c2 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;

		expect(await tryAddConnection('order-1', c1)).toBe(true);
		expect(await tryAddConnection('order-1', c2)).toBe(false);

		removeConnection('order-1', c1);
	});

	it('rejects connections beyond MAX_CHAT_SSE_CONNECTIONS_PER_ORDER', async () => {
		setEnv({
			CACHE_ENABLED: 'false',
			MAX_CHAT_SSE_TOTAL_CONNECTIONS: '10',
			MAX_CHAT_SSE_CONNECTIONS_PER_ORDER: '1'
		});
		const { tryAddConnection, removeConnection } = await loadFreshModule();
		const c1 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;
		const c2 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;

		expect(await tryAddConnection('order-1', c1)).toBe(true);
		expect(await tryAddConnection('order-1', c2)).toBe(false);
		expect(await tryAddConnection('order-2', c2)).toBe(true);

		removeConnection('order-1', c1);
		removeConnection('order-2', c2);
	});

	it('frees a slot once a connection is removed', async () => {
		setEnv({
			CACHE_ENABLED: 'false',
			MAX_CHAT_SSE_TOTAL_CONNECTIONS: '1',
			MAX_CHAT_SSE_CONNECTIONS_PER_ORDER: '5'
		});
		const { tryAddConnection, removeConnection } = await loadFreshModule();
		const c1 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;
		const c2 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;

		expect(await tryAddConnection('order-1', c1)).toBe(true);
		expect(await tryAddConnection('order-1', c2)).toBe(false);
		removeConnection('order-1', c1);
		expect(await tryAddConnection('order-1', c2)).toBe(true);
		removeConnection('order-1', c2);
	});

	it('exposes a heartbeat interval constant', async () => {
		const { HEARTBEAT_INTERVAL } = await loadFreshModule();
		expect(HEARTBEAT_INTERVAL).toBeGreaterThan(0);
	});
});

describe('chat-connections cluster caps via Redis', () => {
	beforeEach(() => {
		ioredisMocks.instance.zcard.mockReset();
	});

	it('rejects when the cluster total count is at or above the configured cap', async () => {
		setEnv({
			CACHE_ENABLED: 'true',
			MAX_CHAT_SSE_CLUSTER_TOTAL_CONNECTIONS: '1'
		});
		ioredisMocks.instance.zcard.mockResolvedValueOnce(1);

		const { tryAddConnection } = await loadFreshModule();
		const controller = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;
		expect(await tryAddConnection('order-1', controller)).toBe(false);
	});

	it('rejects when the cluster per-order count is at the cap', async () => {
		setEnv({
			CACHE_ENABLED: 'true',
			MAX_CHAT_SSE_CLUSTER_CONNECTIONS_PER_ORDER: '1'
		});
		ioredisMocks.instance.zcard.mockResolvedValueOnce(1);

		const { tryAddConnection } = await loadFreshModule();
		const controller = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController;
		expect(await tryAddConnection('order-1', controller)).toBe(false);
	});
});
