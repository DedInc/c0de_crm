import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, and } from 'drizzle-orm';

export async function hasOrderChatPermission(userId: string, orderId: string): Promise<boolean> {
	const permissionResult = await db
		.select()
		.from(schema.orderPermissions)
		.where(
			and(
				eq(schema.orderPermissions.orderId, orderId),
				eq(schema.orderPermissions.userId, userId),
				eq(schema.orderPermissions.permission, 'chat_customers')
			)
		)
		.limit(1);
	const permission = permissionResult[0];

	if (!permission) return false;

	if (permission.expiresAt && permission.expiresAt < new Date()) {
		await db.delete(schema.orderPermissions)
			.where(eq(schema.orderPermissions.id, permission.id));
		return false;
	}

	return true;
}
