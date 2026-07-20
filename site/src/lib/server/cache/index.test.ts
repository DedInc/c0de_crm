import { describe, expect, it, vi } from 'vitest';
import { cacheKey, CacheKeys, CacheTTL } from './index';

vi.mock('$env/dynamic/private', () => ({
	env: { CACHE_ENABLED: 'false' }
}));

describe('cacheKey', () => {
	it('joins prefix and parts with `crm:` namespace', () => {
		expect(cacheKey('users', 'list')).toBe('crm:users:list');
		expect(cacheKey('orders', 'id', 'order-1')).toBe('crm:orders:id:order-1');
	});

	it('serialises numeric parts safely', () => {
		expect(cacheKey('orders', 'page', 12)).toBe('crm:orders:page:12');
	});
});

describe('CacheKeys generators', () => {
	it('produces the expected user, role, order, and marker keys', () => {
		expect(CacheKeys.usersList()).toBe('crm:users:list');
		expect(CacheKeys.userById('user-1')).toBe('crm:users:id:user-1');
		expect(CacheKeys.userByUsername('alice')).toBe('crm:users:username:alice');
		expect(CacheKeys.rolesList()).toBe('crm:roles:list');
		expect(CacheKeys.permissionsList()).toBe('crm:permissions:list');
		expect(CacheKeys.userPermissions('user-1')).toBe('crm:permissions:user:user-1');
		expect(CacheKeys.ordersList()).toBe('crm:orders:list');
		expect(CacheKeys.orderById('order-1')).toBe('crm:orders:id:order-1');
		expect(CacheKeys.ordersPending()).toBe('crm:orders:pending');
		expect(CacheKeys.orderResponses('order-1')).toBe('crm:orders:responses:order-1');
		expect(CacheKeys.orderPermissions('order-1')).toBe('crm:orders:permissions:order-1');
		expect(CacheKeys.markersList()).toBe('crm:markers:list');
		expect(CacheKeys.markerById('marker-1')).toBe('crm:markers:id:marker-1');
		expect(CacheKeys.userMarkers('user-1')).toBe('crm:markers:user:user-1');
		expect(CacheKeys.orderMarkers('order-1')).toBe('crm:markers:order:order-1');
	});
});

describe('CacheTTL constants', () => {
	it('exposes deterministic TTL tiers', () => {
		expect(CacheTTL.SHORT).toBe(60);
		expect(CacheTTL.MEDIUM).toBe(300);
		expect(CacheTTL.LONG).toBe(900);
		expect(CacheTTL.VERY_LONG).toBe(3600);
	});
});

describe('cacheGetOrSet without Redis', () => {
	it('still calls the fetcher and returns the fresh value when cache is disabled', async () => {
		const { cacheGetOrSet } = await import('./index');
		const fetcher = vi.fn(async () => 42);

		const result = await cacheGetOrSet('crm:test:key', fetcher);
		expect(result).toBe(42);
		expect(fetcher).toHaveBeenCalledOnce();
	});
});

describe('isCacheAvailable', () => {
	it('reports false when caching is disabled by env', async () => {
		const { isCacheAvailable } = await import('./index');
		expect(isCacheAvailable()).toBe(false);
	});
});
