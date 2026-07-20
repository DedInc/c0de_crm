import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
		chain.zcard = vi.fn(() => chain);
		chain.zadd = vi.fn(() => chain);
		chain.expire = vi.fn(() => chain);
		chain.exec = vi.fn(() => Promise.resolve(pipelineState.execResult));
		return chain;
	}

	const instance = {
		connect: vi.fn(() => Promise.resolve()),
		on: vi.fn(),
		pipeline: vi.fn(createPipeline),
		zremrangebyscore: vi.fn(() => Promise.resolve()),
		zrange: vi.fn((..._args: unknown[]): Promise<string[]> => Promise.resolve([] as string[]))
	};

	return { instance, pipelineState };
});

vi.mock('ioredis', () => ({
	default: vi.fn(function () {
		return ioredisMocks.instance;
	})
}));

async function loadFresh() {
	vi.resetModules();
	return await import('./rate-limit');
}

function setEnv(values: Record<string, string | undefined>) {
	for (const k of Object.keys(envState.env)) delete envState.env[k];
	Object.assign(envState.env, values);
}

describe('checkRateLimit fail-closed semantics', () => {
	beforeEach(() => {
		setEnv({});
		ioredisMocks.pipelineState.execResult = [];
		ioredisMocks.instance.zrange.mockReset();
		ioredisMocks.instance.zrange.mockResolvedValue([]);
	});

	afterEach(() => {
		setEnv({});
	});

	it('fails closed when no Redis URL is configured', async () => {
		const { checkRateLimit } = await loadFresh();
		const result = await checkRateLimit('login:1.2.3.4', 5, 900);
		expect(result.allowed).toBe(false);
		expect(result.retryAfterSeconds).toBe(900);
	});

	it('honours an env override that opts out of fail-closed', async () => {
		setEnv({ LOGIN_RATE_LIMIT_FAIL_CLOSED: 'false' });
		const { checkRateLimit } = await loadFresh();
		const result = await checkRateLimit('login:1.2.3.4', 5, 900);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(5);
	});

	it('counts attempts when Redis returns valid pipeline data', async () => {
		setEnv({ REDIS_URL: 'redis://localhost:6379' });
		ioredisMocks.pipelineState.execResult = [
			[null, 0],
			[null, 1],
			[null, 1],
			[null, 1]
		];
		const { checkRateLimit } = await loadFresh();
		const result = await checkRateLimit('login:1.2.3.4', 5, 900);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(3);
	});

	it('rejects once attempts reach the cap', async () => {
		setEnv({ REDIS_URL: 'redis://localhost:6379' });
		ioredisMocks.pipelineState.execResult = [
			[null, 0],
			[null, 5],
			[null, 1],
			[null, 1]
		];
		ioredisMocks.instance.zrange.mockResolvedValueOnce(['lease', `${Date.now() - 100}`]);
		const { checkRateLimit } = await loadFresh();
		const result = await checkRateLimit('login:1.2.3.4', 5, 900);
		expect(result.allowed).toBe(false);
		expect(result.retryAfterSeconds).toBeGreaterThan(0);
	});
});
