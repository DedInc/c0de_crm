import { afterEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return env;
	}
}));

const { isInternalApiKeyConfigured, validateInternalApiKey } = await import('./internal-auth');

describe('internal-auth', () => {
	afterEach(() => {
		for (const k of Object.keys(env)) delete env[k];
	});

	it('reports configuration via INTERNAL_API_KEY', () => {
		expect(isInternalApiKeyConfigured()).toBe(false);
		env.INTERNAL_API_KEY = 'secret';
		expect(isInternalApiKeyConfigured()).toBe(true);
	});

	it('rejects when no key is configured', () => {
		expect(validateInternalApiKey('any')).toBe(false);
	});

	it('rejects when caller key is missing', () => {
		env.INTERNAL_API_KEY = 'secret';
		expect(validateInternalApiKey(null)).toBe(false);
		expect(validateInternalApiKey(undefined)).toBe(false);
		expect(validateInternalApiKey('')).toBe(false);
	});

	it('uses constant-time comparison for matching keys', () => {
		env.INTERNAL_API_KEY = 'secret';
		expect(validateInternalApiKey('secret')).toBe(true);
		expect(validateInternalApiKey('different-length')).toBe(false);
		expect(validateInternalApiKey('zecret')).toBe(false);
	});
});
