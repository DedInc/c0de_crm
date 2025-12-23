import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { cacheGetOrSet, cacheDelPattern, CacheKeys, CacheTTL } from './index';

export async function getCachedMarkersList() {
	return cacheGetOrSet(
		CacheKeys.markersList(),
		async () => {
			return await db.select().from(schema.stackMarkers);
		},
		CacheTTL.LONG
	);
}

export async function getCachedOrderMarkers(orderId: string) {
	return cacheGetOrSet(
		CacheKeys.orderMarkers(orderId),
		async () => {
			return await db
				.select({
					id: schema.stackMarkers.id,
					name: schema.stackMarkers.name,
					color: schema.stackMarkers.color
				})
				.from(schema.orderMarkers)
				.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
				.where(eq(schema.orderMarkers.orderId, orderId));
		},
		CacheTTL.MEDIUM
	);
}

export async function invalidateMarkersCache(): Promise<void> {
	await cacheDelPattern('crm:markers:*');
}
