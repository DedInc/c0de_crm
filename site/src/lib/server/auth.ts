import { db } from './db';
import { users, sessions, userRoles, rolePermissions, roles, permissions } from './db/schema';
import { eq } from 'drizzle-orm';
import { compareSync, hashSync } from 'bcryptjs';

export interface AuthUser {
	id: string;
	username: string;
	telegramId: string | null;
	permissions: string[];
	roles: string[];
}

export async function validateCredentials(username: string, password: string): Promise<AuthUser | null> {
	const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
	const user = result[0];
	
	if (!user || !compareSync(password, user.passwordHash)) {
		return null;
	}

	const userPerms = await getUserPermissions(user.id);
	const userRoleNames = await getUserRoles(user.id);

	return {
		id: user.id,
		username: user.username,
		telegramId: user.telegramId,
		permissions: userPerms,
		roles: userRoleNames
	};
}

export async function getUserPermissions(userId: string): Promise<string[]> {
	const result = await db
		.select({ permissionName: permissions.name })
		.from(userRoles)
		.innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(eq(userRoles.userId, userId));

	return [...new Set(result.map((r: { permissionName: string }) => r.permissionName))];
}

export async function getUserRoles(userId: string): Promise<string[]> {
	const result = await db
		.select({ roleName: roles.name })
		.from(userRoles)
		.innerJoin(roles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userId, userId));

	return result.map((r: { roleName: string }) => r.roleName);
}

export async function createSession(userId: string): Promise<string> {
	const sessionId = crypto.randomUUID();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt,
		createdAt: now
	});

	return sessionId;
}

export async function validateSession(sessionId: string): Promise<AuthUser | null> {
	const sessionResult = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);
	const session = sessionResult[0];

	if (!session || session.expiresAt < new Date()) {
		if (session) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
		}
		return null;
	}

	const userResult = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
	const user = userResult[0];
	if (!user) {
		return null;
	}

	const userPerms = await getUserPermissions(user.id);
	const userRoleNames = await getUserRoles(user.id);

	return {
		id: user.id,
		username: user.username,
		telegramId: user.telegramId,
		permissions: userPerms,
		roles: userRoleNames
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
	if (!user) return false;
	return user.permissions.includes(permission);
}

export function hasAnyPermission(user: AuthUser | null, permissions: string[]): boolean {
	if (!user) return false;
	return permissions.some(p => user.permissions.includes(p));
}

export function hasAllPermissions(user: AuthUser | null, permissions: string[]): boolean {
	if (!user) return false;
	return permissions.every(p => user.permissions.includes(p));
}

export function isAdmin(user: AuthUser | null): boolean {
	if (!user) return false;
	return user.roles.includes('Administrator');
}

export async function createUser(
	username: string,
	password: string,
	roleIds: string[],
	telegramId?: string
): Promise<string> {
	const userId = crypto.randomUUID();
	const now = new Date();

	await db.insert(users).values({
		id: userId,
		username,
		passwordHash: hashSync(password, 10),
		telegramId: telegramId || null,
		createdAt: now,
		updatedAt: now
	});

	for (const roleId of roleIds) {
		await db.insert(userRoles).values({
			userId,
			roleId
		});
	}

	return userId;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
	await db.update(users)
		.set({ 
			passwordHash: hashSync(newPassword, 10),
			updatedAt: new Date()
		})
		.where(eq(users.id, userId));
}

export async function updateUserTelegramId(userId: string, telegramId: string | null): Promise<void> {
	await db.update(users)
		.set({ 
			telegramId,
			updatedAt: new Date()
		})
		.where(eq(users.id, userId));
}