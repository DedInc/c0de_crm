import { eq } from 'drizzle-orm';
import { hasPermission, isAdmin, type AuthUser } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { hasOrderChatPermission } from '$lib/server/permissions/orders';
export { getOrderIdFromChatR2Key } from './path';

export async function orderExists(orderId: string): Promise<boolean> {
	const result = await db
		.select({ id: schema.orders.id })
		.from(schema.orders)
		.where(eq(schema.orders.id, orderId))
		.limit(1);

	return !!result[0];
}

export async function canAccessOrderChatFiles(user: AuthUser, orderId: string): Promise<boolean> {
	return (
		hasPermission(user, 'chat_customers') ||
		isAdmin(user) ||
		await hasOrderChatPermission(user.id, orderId)
	);
}
