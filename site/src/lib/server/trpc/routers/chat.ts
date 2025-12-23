import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { protectedProcedure, t } from '../trpc';
import { hasPermission, isAdmin } from '../../auth';
import { sendMessageToBot } from './bot/webhook-helpers';
import { hasOrderChatPermission } from './chat/permissions';

export const chatRouter = t.router({
	getMessages: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			// Check if user has global chat permission, is admin, or has order-specific permission
			const canChat =
				hasPermission(ctx.user, 'chat_customers') ||
				isAdmin(ctx.user) ||
				await hasOrderChatPermission(ctx.user!.id, input.orderId);

			if (!canChat) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'You do not have permission to access this chat'
				});
			}

			const messages = await db
				.select()
				.from(schema.chatMessages)
				.where(eq(schema.chatMessages.orderId, input.orderId))
				.orderBy(schema.chatMessages.createdAt);

			const result = [];
			for (const msg of messages) {
				let senderName = null;
				if (msg.senderId) {
					const senderResult = await db
						.select({ username: schema.users.username })
						.from(schema.users)
						.where(eq(schema.users.id, msg.senderId))
						.limit(1);
					senderName = senderResult[0]?.username || null;
				}
				result.push({ ...msg, senderName });
			}
			return result;
		}),

	sendMessage: protectedProcedure
		.input((v) => {
			const s = Type.Object({
				orderId: Type.String(),
				message: Type.String(),
				imageUrls: Type.Optional(Type.Array(Type.String()))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string; message: string; imageUrls?: string[] };
		})
		.mutation(async ({ input, ctx }) => {
			// Validate that at least message or imageUrls is provided
			if (!input.message && (!input.imageUrls || input.imageUrls.length === 0)) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message or image is required' });
			}

			// Check if user has global chat permission, is admin, or has order-specific permission
			const canChat =
				hasPermission(ctx.user, 'chat_customers') ||
				isAdmin(ctx.user) ||
				await hasOrderChatPermission(ctx.user!.id, input.orderId);

			if (!canChat) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'You do not have permission to send messages in this chat'
				});
			}

			const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.orderId)).limit(1);
			const order = orderResult[0];
			if (!order) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
			}

			const id = crypto.randomUUID();
			const imageUrlsJson = input.imageUrls && input.imageUrls.length > 0 ? JSON.stringify(input.imageUrls) : null;
			
			await db.insert(schema.chatMessages)
				.values({
					id,
					orderId: input.orderId,
					senderId: ctx.user!.id,
					senderType: 'staff',
					message: input.message || '',
					imageUrls: imageUrlsJson,
					createdAt: new Date()
				});

			// Send message to customer via Telegram bot
			if (order.customerTelegramId) {
				await sendMessageToBot(
					order.customerTelegramId,
					input.message || '',
					order.title,
					order.id,
					input.imageUrls
				);
			}

			return { id };
		}),

	getOrdersWithChat: protectedProcedure.query(async ({ ctx }) => {
		// Get orders with messages that the user can access
		const ordersWithMessages = await db
			.selectDistinct({ orderId: schema.chatMessages.orderId })
			.from(schema.chatMessages);

		const orderIds = ordersWithMessages.map((o: { orderId: string }) => o.orderId);
		if (orderIds.length === 0) return [];

		const allOrders = await db
			.select()
			.from(schema.orders)
			.where(inArray(schema.orders.id, orderIds));

		// If user has global chat permission or is admin, return all orders
		if (hasPermission(ctx.user, 'chat_customers') || isAdmin(ctx.user)) {
			return allOrders;
		}

		// Otherwise, filter to only orders where user has specific permission
		const filteredOrders = [];
		for (const order of allOrders) {
			if (await hasOrderChatPermission(ctx.user!.id, order.id)) {
				filteredOrders.push(order);
			}
		}
		return filteredOrders;
	}),

	// Check if user can chat for a specific order
	canChatForOrder: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			return (
				hasPermission(ctx.user, 'chat_customers') ||
				isAdmin(ctx.user) ||
				await hasOrderChatPermission(ctx.user!.id, input.orderId)
			);
		})
});