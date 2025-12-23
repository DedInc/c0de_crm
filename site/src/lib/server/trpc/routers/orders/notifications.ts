import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { notifyBot, notifyStaff } from '../bot/webhook-helpers';
import { getUsersWithPermission } from './permissions';
import { isValidTelegramId } from './validation';

export type NotificationType = 'order_approved' | 'order_rejected' | 'order_assigned' | 'order_status_changed';
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

export async function notifyCustomer(data: NotificationData): Promise<boolean> {
	return notifyBot(data.type, data as unknown as Record<string, unknown>);
}

export async function notifyStaffMember(data: StaffNotificationData): Promise<boolean> {
	return notifyStaff(data.type, data as unknown as Record<string, unknown>);
}

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
