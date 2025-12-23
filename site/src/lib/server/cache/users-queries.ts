import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
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
			const result: UserWithRolesAndMarkers[] = [];

			for (const user of allUsers) {
				const userRolesList = await db
					.select({ roleId: schema.userRoles.roleId, roleName: schema.roles.name })
					.from(schema.userRoles)
					.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
					.where(eq(schema.userRoles.userId, user.id));

				const markers = await db
					.select({
						id: schema.stackMarkers.id,
						name: schema.stackMarkers.name,
						color: schema.stackMarkers.color
					})
					.from(schema.userMarkers)
					.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
					.where(eq(schema.userMarkers.userId, user.id));

				result.push({
					id: user.id,
					username: user.username,
					telegramId: user.telegramId,
					createdAt: user.createdAt,
					roles: userRolesList,
					markers
				});
			}

			return result;
		},
		CacheTTL.MEDIUM
	);
}

export async function invalidateUsersCache(): Promise<void> {
	await cacheDelPattern('crm:users:*');
}
