import { trpc } from '$lib/trpc/client';
import type { Order, PaymentInfo } from './types';

export async function loadOrder(orderId: string): Promise<Order> {
	return await trpc.orders.getById.query({ id: orderId });
}

export async function checkChatAccess(orderId: string): Promise<boolean> {
	try {
		return await trpc.chat.canChatForOrder.query({ orderId });
	} catch {
		return false;
	}
}

export async function loadPaymentInfo(orderId: string): Promise<PaymentInfo[]> {
	try {
		return await trpc.orderPayment.getByOrderId.query({ orderId });
	} catch {
		return [];
	}
}

export async function checkPaymentPermission(orderId: string): Promise<boolean> {
	try {
		return await trpc.orderPayment.canSendPaymentInfo.query({ orderId });
	} catch {
		return false;
	}
}

export function loadUsersFromResponses(order: Order | null): { id: string; username: string }[] {
	if (!order || !order.responses) return [];
	
	return order.responses
		.filter((r) => r.user && r.user.id !== order.assignedTo?.id)
		.map((r) => ({ id: r.user!.id, username: r.user!.username }));
}

export async function approveOrder(orderId: string): Promise<void> {
	await trpc.orders.approve.mutate({ id: orderId });
}

export async function rejectOrder(orderId: string): Promise<void> {
	await trpc.orders.reject.mutate({ id: orderId });
}

export async function submitResponse(orderId: string, proposedPrice: number, message?: string): Promise<void> {
	await trpc.orders.respond.mutate({
		orderId,
		proposedPrice,
		message
	});
}

export async function assignOrder(orderId: string, userId: string): Promise<void> {
	await trpc.orders.assign.mutate({
		orderId,
		userId
	});
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
	await trpc.orders.updateStatus.mutate({
		orderId,
		status: status as 'in_progress' | 'testing' | 'completed' | 'delivered'
	});
}
