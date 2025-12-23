import * as schema from '../../../db/schema';
import { getOrderMarkers, getAssignedUser, getOrderResponsesWithUsers, getPaymentMethod } from './queries';

export async function enrichOrder(order: typeof schema.orders.$inferSelect) {
	return {
		...order,
		markers: await getOrderMarkers(order.id),
		assignedTo: await getAssignedUser(order.assignedToId),
		responses: await getOrderResponsesWithUsers(order.id),
		paymentMethodDetails: await getPaymentMethod(order.paymentMethod)
	};
}

export async function enrichOrderWithMarkers(order: typeof schema.orders.$inferSelect) {
	return {
		...order,
		markers: await getOrderMarkers(order.id)
	};
}

export const statusNames: Record<string, { en: string; ru: string }> = {
	pending_moderation: { en: '⏳ Pending Moderation', ru: '⏳ На модерации' },
	rejected: { en: '❌ Rejected', ru: '❌ Отклонён' },
	approved: { en: '✅ Approved', ru: '✅ Одобрен' },
	in_progress: { en: '🔄 In Progress', ru: '🔄 В работе' },
	testing: { en: '🧪 Testing', ru: '🧪 Тестирование' },
	completed: { en: '✅ Completed', ru: '✅ Завершён' },
	delivered: { en: '📦 Delivered', ru: '📦 Доставлен' }
};
