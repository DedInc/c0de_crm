import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { cacheGetOrSet, cacheDel, cacheDelPattern, CacheKeys, CacheTTL } from './index';

export interface RoleWithPermissions {
	id: string;
	name: string;
	description: string | null;
	createdAt: Date;
	permissions: Array<{ permissionId: string; permissionName: string }>;
}

export async function getCachedRolesList(): Promise<RoleWithPermissions[]> {
	return cacheGetOrSet(
		CacheKeys.rolesList(),
		async () => {
			const allRoles = await db.select().from(schema.roles);
			const result: RoleWithPermissions[] = [];

			for (const role of allRoles) {
				const perms = await db
					.select({
						permissionId: schema.rolePermissions.permissionId,
						permissionName: schema.permissions.name
					})
					.from(schema.rolePermissions)
					.innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
					.where(eq(schema.rolePermissions.roleId, role.id));

				result.push({
					...role,
					permissions: perms
				});
			}

			return result;
		},
		CacheTTL.LONG
	);
}

export async function invalidateRolesCache(): Promise<void> {
	await cacheDelPattern('crm:roles:*');
	await cacheDelPattern('crm:permissions:user:*');
}

export async function getCachedPermissionsList() {
	return cacheGetOrSet(
		CacheKeys.permissionsList(),
		async () => {
			return await db.select().from(schema.permissions);
		},
		CacheTTL.VERY_LONG
	);
}

export async function getCachedUserPermissions(userId: string): Promise<string[]> {
	return cacheGetOrSet(
		CacheKeys.userPermissions(userId),
		async () => {
			const userRoles = await db
				.select({ roleId: schema.userRoles.roleId })
				.from(schema.userRoles)
				.where(eq(schema.userRoles.userId, userId));

			const permissions: string[] = [];
			for (const { roleId } of userRoles) {
				const rolePerms = await db
					.select({ name: schema.permissions.name })
					.from(schema.rolePermissions)
					.innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
					.where(eq(schema.rolePermissions.roleId, roleId));
				
				for (const { name } of rolePerms) {
					if (!permissions.includes(name)) {
						permissions.push(name);
					}
				}
			}

			return permissions;
		},
		CacheTTL.MEDIUM
	);
}

export async function invalidateUserPermissionsCache(userId: string): Promise<void> {
	await cacheDel(CacheKeys.userPermissions(userId));
}
