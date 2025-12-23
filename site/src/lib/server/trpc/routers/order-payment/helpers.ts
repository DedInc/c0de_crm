import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { notifyBot, notifyStaff } from '../bot/webhook-helpers';

export const PAYMENT_ALLOWED_STATUSES = ['in_progress', 'testing', 'completed', 'delivered'];

export async function notifyProgrammerAboutPayment(
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

	if (!user?.telegramId) {
		return false;
	}

	return notifyStaff('payment_info_sent', {
		telegramId: user.telegramId,
		orderTitle,
		orderId
	});
}

export async function notifyCustomerAboutPayment(
	customerTelegramId: string,
	orderTitle: string,
	paymentMethodName: string,
	paymentDetails: string,
	totalAmount: number
): Promise<boolean> {
	return notifyBot('payment_info_received', {
		telegramId: customerTelegramId,
		orderTitle,
		paymentMethodName,
		paymentDetails,
		totalAmount
	});
}
