import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { publicProcedure } from '../../trpc';
import { notifyNewMessage } from '../../../sse/chat-connections';
import { notifyModeratorsAboutNewOrder } from '../orders/helpers';

export const orderProcedures = {
	createOrder: publicProcedure
		.input((v) => {
			const s = Type.Object({
				title: Type.String({ minLength: 1 }),
				description: Type.String({ minLength: 1 }),
				cost: Type.Number({ minimum: 0 }),
				customerTelegramId: Type.String(),
				customerName: Type.Optional(Type.String()),
				markerIds: Type.Optional(Type.Array(Type.String())),
				paymentMethod: Type.Optional(Type.String())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				title: string;
				description: string;
				cost: number;
				customerTelegramId: string;
				customerName?: string;
				markerIds?: string[];
				paymentMethod?: string;
			};
		})
		.mutation(async ({ input }) => {
			const openOrders = await db
				.select()
				.from(schema.orders)
				.where(
					and(
						eq(schema.orders.customerTelegramId, input.customerTelegramId),
						inArray(schema.orders.status, ['pending_moderation', 'approved', 'in_progress', 'testing'])
					)
				);

			if (openOrders.length >= 2) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Maximum 2 open orders allowed per customer'
				});
			}

			const orderId = crypto.randomUUID();
			const now = new Date();

			await db.insert(schema.orders).values({
				id: orderId,
				title: input.title,
				description: input.description,
				cost: input.cost,
				status: 'pending_moderation',
				paymentMethod: input.paymentMethod || null,
				customerTelegramId: input.customerTelegramId,
				customerName: input.customerName || null,
				createdAt: now,
				updatedAt: now
			});

			if (input.markerIds) {
				for (const markerId of input.markerIds) {
					await db.insert(schema.orderMarkers).values({ orderId, markerId });
				}
			}

			await notifyModeratorsAboutNewOrder(orderId, input.title);
			return { id: orderId };
		}),

	getCustomerOrders: publicProcedure
		.input((v) => {
			const s = Type.Object({ customerTelegramId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { customerTelegramId: string };
		})
		.query(async ({ input }) => {
			const orders = await db
				.select()
				.from(schema.orders)
				.where(eq(schema.orders.customerTelegramId, input.customerTelegramId))
				.orderBy(desc(schema.orders.createdAt));

			const result = [];
			for (const order of orders) {
				const markers = await db
					.select({
						id: schema.stackMarkers.id,
						name: schema.stackMarkers.name,
						color: schema.stackMarkers.color
					})
					.from(schema.orderMarkers)
					.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
					.where(eq(schema.orderMarkers.orderId, order.id));

				result.push({ ...order, markers });
			}
			return result;
		}),

	deleteOrder: publicProcedure
		.input((v) => {
			const s = Type.Object({
				orderId: Type.String(),
				customerTelegramId: Type.String()
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string; customerTelegramId: string };
		})
		.mutation(async ({ input }) => {
			const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.orderId)).limit(1);
			const order = orderResult[0];
			if (!order) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
			}
			if (order.customerTelegramId !== input.customerTelegramId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your order' });
			}

			const deletableStatuses = ['pending_moderation', 'rejected'];
			if (!deletableStatuses.includes(order.status)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot delete order in current status. Only pending or rejected orders can be deleted.'
				});
			}

			await db.delete(schema.orderMarkers).where(eq(schema.orderMarkers.orderId, input.orderId));
			await db.delete(schema.chatMessages).where(eq(schema.chatMessages.orderId, input.orderId));
			await db.delete(schema.orderResponses).where(eq(schema.orderResponses.orderId, input.orderId));
			await db.delete(schema.orders).where(eq(schema.orders.id, input.orderId));

			return { success: true };
		}),

	sendCustomerMessage: publicProcedure
		.input((v) => {
			const s = Type.Object({
				orderId: Type.String(),
				customerTelegramId: Type.String(),
				message: Type.String(),
				imageUrls: Type.Optional(Type.Array(Type.String()))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string; customerTelegramId: string; message: string; imageUrls?: string[] };
		})
		.mutation(async ({ input }) => {
			if (!input.message && (!input.imageUrls || input.imageUrls.length === 0)) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message or image is required' });
			}

			const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.orderId)).limit(1);
			const order = orderResult[0];
			if (!order) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
			}
			if (order.customerTelegramId !== input.customerTelegramId) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your order' });
			}

			const id = crypto.randomUUID();
			const createdAt = new Date();
			const imageUrlsJson = input.imageUrls && input.imageUrls.length > 0 ? JSON.stringify(input.imageUrls) : null;

			await db.insert(schema.chatMessages).values({
				id,
				orderId: input.orderId,
				senderId: null,
				senderType: 'customer',
				message: input.message || '',
				imageUrls: imageUrlsJson,
				createdAt
			});

			notifyNewMessage(input.orderId, {
				type: 'new_message',
				message: {
					id,
					orderId: input.orderId,
					senderId: null,
					senderType: 'customer',
					message: input.message || '',
					imageUrls: input.imageUrls || null,
					createdAt: createdAt.toISOString(),
					senderName: null
				}
			});

			return { id };
		})
};
