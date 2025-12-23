import Redis from 'ioredis';

// Cache configuration from environment (with defaults)
const cacheConfig = {
	enabled: process.env.CACHE_ENABLED === 'true',
	ttl: parseInt(process.env.CACHE_TTL || '300', 10),
	redis: {
		url: process.env.REDIS_URL || 'redis://localhost:6379',
		maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
		retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
		connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
		commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10)
	}
};

// Redis client singleton
let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Get or create Redis client instance
 */
function getRedisClient(): Redis | null {
	if (!cacheConfig.enabled) {
		return null;
	}

	if (redisClient) {
		return redisClient;
	}

	try {
		redisClient = new Redis(cacheConfig.redis.url, {
			maxRetriesPerRequest: cacheConfig.redis.maxRetries,
			retryStrategy: (times) => {
				if (times > cacheConfig.redis.maxRetries) {
					// Max retries reached, giving up
					return null;
				}
				return Math.min(times * cacheConfig.redis.retryDelay, 2000);
			},
			connectTimeout: cacheConfig.redis.connectTimeout,
			commandTimeout: cacheConfig.redis.commandTimeout,
			lazyConnect: true,
			enableReadyCheck: true,
			enableOfflineQueue: false
		});

		redisClient.on('connect', () => {
			isConnected = true;
		});

		redisClient.on('error', () => {
			isConnected = false;
		});

		redisClient.on('close', () => {
			isConnected = false;
		});

		// Attempt to connect
		redisClient.connect().catch(() => {
			isConnected = false;
		});

		return redisClient;
	} catch {
		return null;
	}
}

/**
 * Check if cache is available and connected
 */
export function isCacheAvailable(): boolean {
	return cacheConfig.enabled && isConnected;
}

/**
 * Generate a cache key with optional prefix
 */
export function cacheKey(prefix: string, ...parts: (string | number)[]): string {
	return `crm:${prefix}:${parts.join(':')}`;
}

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const client = getRedisClient();
	if (!client || !isConnected) {
		return null;
	}

	try {
		const value = await client.get(key);
		if (value) {
			return JSON.parse(value) as T;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Set a value in cache with optional TTL
 */
export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<boolean> {
	const client = getRedisClient();
	if (!client || !isConnected) {
		return false;
	}

	try {
		const serialized = JSON.stringify(value);
		const effectiveTtl = ttl ?? cacheConfig.ttl;
		
		if (effectiveTtl > 0) {
			await client.setex(key, effectiveTtl, serialized);
		} else {
			await client.set(key, serialized);
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Delete a value from cache
 */
export async function cacheDel(key: string): Promise<boolean> {
	const client = getRedisClient();
	if (!client || !isConnected) {
		return false;
	}

	try {
		await client.del(key);
		return true;
	} catch {
		return false;
	}
}

/**
 * Delete multiple keys matching a pattern
 */
export async function cacheDelPattern(pattern: string): Promise<boolean> {
	const client = getRedisClient();
	if (!client || !isConnected) {
		return false;
	}

	try {
		const keys = await client.keys(pattern);
		if (keys.length > 0) {
			await client.del(...keys);
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Get or set a cached value (cache-aside pattern)
 */
export async function cacheGetOrSet<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttl?: number
): Promise<T> {
	// Try to get from cache first
	const cached = await cacheGet<T>(key);
	if (cached !== null) {
		return cached;
	}

	// Fetch fresh data
	const fresh = await fetcher();

	// Store in cache (don't await to avoid blocking)
	cacheSet(key, fresh, ttl).catch(() => {
		// Silently ignore cache set errors
	});

	return fresh;
}

/**
 * Invalidate cache for a specific entity type
 */
export async function invalidateCache(entityType: 'users' | 'roles' | 'orders' | 'markers' | 'permissions'): Promise<void> {
	await cacheDelPattern(`crm:${entityType}:*`);
}

/**
 * Invalidate all cache
 */
export async function invalidateAllCache(): Promise<void> {
	await cacheDelPattern('crm:*');
}

// Cache key generators for different entities
export const CacheKeys = {
	// Users
	usersList: () => cacheKey('users', 'list'),
	userById: (id: string) => cacheKey('users', 'id', id),
	userByUsername: (username: string) => cacheKey('users', 'username', username),
	
	// Roles
	rolesList: () => cacheKey('roles', 'list'),
	roleById: (id: string) => cacheKey('roles', 'id', id),
	
	// Permissions
	permissionsList: () => cacheKey('permissions', 'list'),
	userPermissions: (userId: string) => cacheKey('permissions', 'user', userId),
	
	// Orders
	ordersList: () => cacheKey('orders', 'list'),
	orderById: (id: string) => cacheKey('orders', 'id', id),
	ordersPending: () => cacheKey('orders', 'pending'),
	orderResponses: (orderId: string) => cacheKey('orders', 'responses', orderId),
	orderPermissions: (orderId: string) => cacheKey('orders', 'permissions', orderId),
	
	// Markers
	markersList: () => cacheKey('markers', 'list'),
	markerById: (id: string) => cacheKey('markers', 'id', id),
	userMarkers: (userId: string) => cacheKey('markers', 'user', userId),
	orderMarkers: (orderId: string) => cacheKey('markers', 'order', orderId)
};

// TTL constants (in seconds)
export const CacheTTL = {
	SHORT: 60,           // 1 minute - for frequently changing data
	MEDIUM: 300,         // 5 minutes - default
	LONG: 900,           // 15 minutes - for rarely changing data
	VERY_LONG: 3600      // 1 hour - for static data
};