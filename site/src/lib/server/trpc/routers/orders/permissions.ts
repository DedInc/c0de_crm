import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { isValidTelegramId } from './validation';

export async function getUsersWithPermission(
	permissionName: string
): Promise<{ id: string; username: string; telegramId: string }[]> {
	const usersWithPermission = await db
		.select({
			id: schema.users.id,
			username: schema.users.username,
			telegramId: schema.users.telegramId
		})
		.from(schema.users)
		.innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
		.innerJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.userRoles.roleId))
		.innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
		.where(eq(schema.permissions.name, permissionName));

	const uniqueUsers = new Map<string, { id: string; username: string; telegramId: string }>();
	for (const user of usersWithPermission) {
		if (isValidTelegramId(user.telegramId) && !uniqueUsers.has(user.id)) {
			uniqueUsers.set(user.id, user as { id: string; username: string; telegramId: string });
		}
	}

	return Array.from(uniqueUsers.values());
}
