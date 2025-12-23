import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { cacheGetOrSet, cacheDel, cacheDelPattern, CacheKeys, CacheTTL } from './index';

export async function getCachedOrdersList() {
	return cacheGetOrSet(
		CacheKeys.ordersList(),
		async () => {
			return await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
		},
		CacheTTL.SHORT
	);
}

export async function getCachedOrderById(orderId: string) {
	return cacheGetOrSet(
		CacheKeys.orderById(orderId),
		async () => {
			const result = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
			return result[0] || null;
		},
		CacheTTL.SHORT
	);
}

export async function invalidateOrdersCache(): Promise<void> {
	await cacheDelPattern('crm:orders:*');
}

export async function invalidateOrderCache(orderId: string): Promise<void> {
	await cacheDel(CacheKeys.orderById(orderId));
	await cacheDel(CacheKeys.ordersList());
	await cacheDel(CacheKeys.ordersPending());
	await cacheDel(CacheKeys.orderResponses(orderId));
	await cacheDel(CacheKeys.orderPermissions(orderId));
	await cacheDel(CacheKeys.orderMarkers(orderId));
}
