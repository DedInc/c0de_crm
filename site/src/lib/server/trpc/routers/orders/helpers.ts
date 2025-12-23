import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:8081';

/**
 * Validate that a Telegram ID is in the correct format (7-15 digit number)
 * Telegram IDs are numeric and typically 7-10 digits, but can be longer for newer accounts
 */
function isValidTelegramId(telegramId: string | null | undefined): telegramId is string {
	if (!telegramId) return false;
	return /^\d{7,15}$/.test(telegramId);
}

/**
 * Notification types for localized messages
 */
export type NotificationType =
	| 'order_approved'
	| 'order_rejected'
	| 'order_assigned'
	| 'order_status_changed';

export type StaffNotificationType = 'order_assigned' | 'new_response' | 'new_order_moderation' | 'chat_access_granted';

export interface NotificationData {
	type: NotificationType;
	telegramId: string;
	orderTitle: string;
	status?: string;
}

export interface StaffNotificationData {
	type: StaffNotificationType;
	telegramId: string;
	orderTitle: string;
	orderId: string;
	responderUsername?: string;
}

/**
 * Send localized notification to customer via bot
 */
export async function notifyCustomer(data: NotificationData): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/notify`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Send notification to a staff member via bot
 */
export async function notifyStaffMember(data: StaffNotificationData): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/notify-staff`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Get users with a specific permission and linked Telegram accounts
 */
export async function getUsersWithPermission(permissionName: string): Promise<{ id: string; username: string; telegramId: string }[]> {
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

	// Remove duplicates (user might have permission through multiple roles)
	// and filter out users with invalid Telegram IDs
	const uniqueUsers = new Map<string, { id: string; username: string; telegramId: string }>();
	for (const user of usersWithPermission) {
		if (isValidTelegramId(user.telegramId) && !uniqueUsers.has(user.id)) {
			uniqueUsers.set(user.id, user as { id: string; username: string; telegramId: string });
		}
	}

	return Array.from(uniqueUsers.values());
}

/**
 * Notify users with assign_orders permission about a new response
 */
export async function notifyAssignersAboutResponse(
	orderId: string,
	orderTitle: string,
	responderUsername: string
): Promise<void> {
	const assigners = await getUsersWithPermission('assign_orders');
	
	const notifications = assigners.map((user) =>
		notifyStaffMember({
			type: 'new_response',
			telegramId: user.telegramId,
			orderTitle,
			orderId,
			responderUsername
		})
	);

	await Promise.allSettled(notifications);
}

/**
 * Notify users with moderate_orders permission about a new order for moderation
 */
export async function notifyModeratorsAboutNewOrder(orderId: string, orderTitle: string): Promise<void> {
	const moderators = await getUsersWithPermission('moderate_orders');
	
	const notifications = moderators.map((user) =>
		notifyStaffMember({
			type: 'new_order_moderation',
			telegramId: user.telegramId,
			orderTitle,
			orderId
		})
	);

	await Promise.allSettled(notifications);
}

/**
 * Notify a specific user about being assigned to an order
 */
export async function notifyUserAboutAssignment(
	userId: string,
	orderId: string,
	orderTitle: string
): Promise<boolean> {
	const userResult = await db
		.select({ telegramId: schema.users.telegramId })
		.from(schema.users)
		.where(eq(schema.users.id, userId))
		.limit(1);
	const user = userResult[0];

	if (!isValidTelegramId(user?.telegramId)) {
		return false;
	}

	return notifyStaffMember({
		type: 'order_assigned',
		telegramId: user.telegramId,
		orderTitle,
		orderId
	});
}

/**
 * Notify a specific user about being granted chat access for an order
 */
export async function notifyUserAboutChatAccess(
	userId: string,
	orderId: string,
	orderTitle: string
): Promise<boolean> {
	const userResult = await db
		.select({ telegramId: schema.users.telegramId })
		.from(schema.users)
		.where(eq(schema.users.id, userId))
		.limit(1);
	const user = userResult[0];

	if (!isValidTelegramId(user?.telegramId)) {
		return false;
	}

	return notifyStaffMember({
		type: 'chat_access_granted',
		telegramId: user.telegramId,
		orderTitle,
		orderId
	});
}

/**
 * Status display names for notifications
 */
export const statusNames: Record<string, { en: string; ru: string }> = {
	pending_moderation: { en: '⏳ Pending Moderation', ru: '⏳ На модерации' },
	rejected: { en: '❌ Rejected', ru: '❌ Отклонён' },
	approved: { en: '✅ Approved', ru: '✅ Одобрен' },
	in_progress: { en: '🔄 In Progress', ru: '🔄 В работе' },
	testing: { en: '🧪 Testing', ru: '🧪 Тестирование' },
	completed: { en: '✅ Completed', ru: '✅ Завершён' },
	delivered: { en: '📦 Delivered', ru: '📦 Доставлен' }
};

/**
 * Get payment method by ID
 */
export async function getPaymentMethod(paymentMethodId: string | null) {
	if (!paymentMethodId) return null;
	const result = await db
		.select({
			id: schema.paymentMethods.id,
			name: schema.paymentMethods.name,
			details: schema.paymentMethods.details
		})
		.from(schema.paymentMethods)
		.where(eq(schema.paymentMethods.id, paymentMethodId))
		.limit(1);
	return result[0] || null;
}

/**
 * Get order markers by order ID
 */
export async function getOrderMarkers(orderId: string) {
	return await db
		.select({
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.orderMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
		.where(eq(schema.orderMarkers.orderId, orderId));
}

/**
 * Get assigned user by ID
 */
export async function getAssignedUser(assignedToId: string | null) {
	if (!assignedToId) return null;
	const result = await db
		.select({ id: schema.users.id, username: schema.users.username })
		.from(schema.users)
		.where(eq(schema.users.id, assignedToId))
		.limit(1);
	return result[0] || null;
}

/**
 * Get user markers by user ID
 */
export async function getUserMarkers(userId: string) {
	return await db
		.select({
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.userMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
		.where(eq(schema.userMarkers.userId, userId));
}

/**
 * Get order responses with user information and their markers
 */
export async function getOrderResponsesWithUsers(orderId: string) {
	const responses = await db
		.select()
		.from(schema.orderResponses)
		.where(eq(schema.orderResponses.orderId, orderId));

	const result = [];
	for (const resp of responses) {
		const respUserResult = await db
			.select({ id: schema.users.id, username: schema.users.username })
			.from(schema.users)
			.where(eq(schema.users.id, resp.userId))
			.limit(1);
		const respUser = respUserResult[0];
		
		const userMarkers = respUser ? await getUserMarkers(respUser.id) : [];
		
		result.push({
			...resp,
			user: respUser ? { ...respUser, markers: userMarkers } : respUser
		});
	}
	return result;
}

/**
 * Enrich order with markers, assigned user, responses, and payment method
 */
export async function enrichOrder(order: typeof schema.orders.$inferSelect) {
	return {
		...order,
		markers: await getOrderMarkers(order.id),
		assignedTo: await getAssignedUser(order.assignedToId),
		responses: await getOrderResponsesWithUsers(order.id),
		paymentMethodDetails: await getPaymentMethod(order.paymentMethod)
	};
}

/**
 * Enrich order with markers only (for list views)
 */
export async function enrichOrderWithMarkers(order: typeof schema.orders.$inferSelect) {
	return {
		...order,
		markers: await getOrderMarkers(order.id)
	};
}