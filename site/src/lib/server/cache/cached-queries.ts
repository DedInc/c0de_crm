/**
 * Cached data access layer
 * Provides cached versions of common database queries
 */

import { db } from '../db';
import * as schema from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { cacheGetOrSet, cacheDel, cacheDelPattern, CacheKeys, CacheTTL } from './index';

// ============================================================================
// Users
// ============================================================================

export interface UserWithRolesAndMarkers {
	id: string;
	username: string;
	telegramId: string | null;
	createdAt: Date;
	roles: Array<{ roleId: string; roleName: string }>;
	markers: Array<{ id: string; name: string; color: string }>;
}

/**
 * Get all users with their roles and markers (cached)
 */
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

/**
 * Invalidate users cache
 */
export async function invalidateUsersCache(): Promise<void> {
	await cacheDelPattern('crm:users:*');
}

// ============================================================================
// Roles
// ============================================================================

export interface RoleWithPermissions {
	id: string;
	name: string;
	description: string | null;
	createdAt: Date;
	permissions: Array<{ permissionId: string; permissionName: string }>;
}

/**
 * Get all roles with their permissions (cached)
 */
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

/**
 * Invalidate roles cache
 */
export async function invalidateRolesCache(): Promise<void> {
	await cacheDelPattern('crm:roles:*');
	// Also invalidate user permissions cache since roles affect permissions
	await cacheDelPattern('crm:permissions:user:*');
}

// ============================================================================
// Permissions
// ============================================================================

/**
 * Get all permissions (cached)
 */
export async function getCachedPermissionsList() {
	return cacheGetOrSet(
		CacheKeys.permissionsList(),
		async () => {
			return await db.select().from(schema.permissions);
		},
		CacheTTL.VERY_LONG // Permissions rarely change
	);
}

/**
 * Get user permissions (cached)
 */
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

/**
 * Invalidate user permissions cache
 */
export async function invalidateUserPermissionsCache(userId: string): Promise<void> {
	await cacheDel(CacheKeys.userPermissions(userId));
}

// ============================================================================
// Markers
// ============================================================================

/**
 * Get all stack markers (cached)
 */
export async function getCachedMarkersList() {
	return cacheGetOrSet(
		CacheKeys.markersList(),
		async () => {
			return await db.select().from(schema.stackMarkers);
		},
		CacheTTL.LONG
	);
}

/**
 * Get markers for a specific order (cached)
 */
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

/**
 * Invalidate markers cache
 */
export async function invalidateMarkersCache(): Promise<void> {
	await cacheDelPattern('crm:markers:*');
}

// ============================================================================
// Orders
// ============================================================================

/**
 * Get all orders (cached for short duration due to frequent updates)
 */
export async function getCachedOrdersList() {
	return cacheGetOrSet(
		CacheKeys.ordersList(),
		async () => {
			return await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
		},
		CacheTTL.SHORT
	);
}

/**
 * Get order by ID (cached)
 */
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

/**
 * Invalidate orders cache
 */
export async function invalidateOrdersCache(): Promise<void> {
	await cacheDelPattern('crm:orders:*');
}

/**
 * Invalidate specific order cache
 */
export async function invalidateOrderCache(orderId: string): Promise<void> {
	await cacheDel(CacheKeys.orderById(orderId));
	await cacheDel(CacheKeys.ordersList());
	await cacheDel(CacheKeys.ordersPending());
	await cacheDel(CacheKeys.orderResponses(orderId));
	await cacheDel(CacheKeys.orderPermissions(orderId));
	await cacheDel(CacheKeys.orderMarkers(orderId));
}