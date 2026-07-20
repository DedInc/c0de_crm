import { db } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { cacheGetOrSet, cacheDelPattern, CacheKeys, CacheTTL } from './index';

export interface UserWithRolesAndMarkers {
	id: string;
	username: string;
	telegramId: string | null;
	createdAt: Date;
	roles: Array<{ roleId: string; roleName: string }>;
	markers: Array<{ id: string; name: string; color: string }>;
}

export async function getCachedUsersList(): Promise<UserWithRolesAndMarkers[]> {
	return cacheGetOrSet(
		CacheKeys.usersList(),
		async () => {
			const allUsers = await db.select().from(schema.users);
			if (allUsers.length === 0) return [];

			const userIds = allUsers.map((u) => u.id);

			const allRoles = await db
				.select({
					userId: schema.userRoles.userId,
					roleId: schema.userRoles.roleId,
					roleName: schema.roles.name
				})
				.from(schema.userRoles)
				.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
				.where(sql`${schema.userRoles.userId} IN ${userIds}`);

			const allMarkers = await db
				.select({
					userId: schema.userMarkers.userId,
					id: schema.stackMarkers.id,
					name: schema.stackMarkers.name,
					color: schema.stackMarkers.color
				})
				.from(schema.userMarkers)
				.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
				.where(sql`${schema.userMarkers.userId} IN ${userIds}`);

			const rolesByUser = new Map<string, Array<{ roleId: string; roleName: string }>>();
			for (const r of allRoles) {
				if (!rolesByUser.has(r.userId)) rolesByUser.set(r.userId, []);
				rolesByUser.get(r.userId)!.push({ roleId: r.roleId, roleName: r.roleName });
			}

			const markersByUser = new Map<string, Array<{ id: string; name: string; color: string }>>();
			for (const m of allMarkers) {
				if (!markersByUser.has(m.userId)) markersByUser.set(m.userId, []);
				markersByUser.get(m.userId)!.push({ id: m.id, name: m.name, color: m.color });
			}

			return allUsers.map((user) => ({
				id: user.id,
				username: user.username,
				telegramId: user.telegramId,
				createdAt: user.createdAt,
				roles: rolesByUser.get(user.id) ?? [],
				markers: markersByUser.get(user.id) ?? []
			}));
		},
		CacheTTL.MEDIUM
	);
}

export async function invalidateUsersCache(): Promise<void> {
	await cacheDelPattern('crm:users:*');
}
