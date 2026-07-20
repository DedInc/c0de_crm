import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { internalProcedure } from '../../trpc';
import { notifyNewMessage } from '../../../sse/chat-connections';
import { notifyModeratorsAboutNewOrder } from '../orders/helpers';
import { deleteFilesByPrefix, isR2Configured } from '../../../r2';
import { invalidateCache } from '../../../cache';

export const orderProcedures = {
	createOrder: internalProcedure
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

			await db.transaction(async (tx) => {
				await tx.insert(schema.orders).values({
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
						await tx.insert(schema.orderMarkers).values({ orderId, markerId });
					}
				}
			});

			await invalidateCache('orders');

			await notifyModeratorsAboutNewOrder(orderId, input.title);
			return { id: orderId };
		}),

	getCustomerOrders: internalProcedure
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

	deleteOrder: internalProcedure
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

			await db.transaction(async (tx) => {
				await tx.delete(schema.orderMarkers).where(eq(schema.orderMarkers.orderId, input.orderId));
				await tx.delete(schema.chatMessages).where(eq(schema.chatMessages.orderId, input.orderId));
				await tx.delete(schema.orderResponses).where(eq(schema.orderResponses.orderId, input.orderId));
				await tx.delete(schema.orders).where(eq(schema.orders.id, input.orderId));
			});

			await invalidateCache('orders');

			// Clean up R2 files for this order
			if (isR2Configured()) {
				try {
					await deleteFilesByPrefix(`chat/${input.orderId}/`);
				} catch {
					// Non-critical: log but don't fail the delete
				}
			}

			return { success: true };
		}),

	sendCustomerMessage: internalProcedure
		.input((v) => {
			const s = Type.Object({
				orderId: Type.String(),
				customerTelegramId: Type.String(),
				message: Type.String(),
				imageUrls: Type.Optional(Type.Array(Type.String())),
				fileUrls: Type.Optional(Type.Array(Type.Object({
					url: Type.String(),
					name: Type.String(),
					type: Type.String()
				})))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string; customerTelegramId: string; message: string; imageUrls?: string[]; fileUrls?: { url: string; name: string; type: string }[] };
		})
		.mutation(async ({ input }) => {
			if (!input.message && (!input.imageUrls || input.imageUrls.length === 0) && (!input.fileUrls || input.fileUrls.length === 0)) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message, image, or file is required' });
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
			await db.insert(schema.chatMessages).values({
				id,
				orderId: input.orderId,
				senderId: null,
				senderType: 'customer',
				message: input.message || '',
				imageUrls: input.imageUrls && input.imageUrls.length > 0 ? input.imageUrls : null,
				fileUrls: input.fileUrls && input.fileUrls.length > 0 ? input.fileUrls : null,
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
					fileUrls: input.fileUrls || null,
					createdAt: createdAt.toISOString(),
					senderName: null
				}
			});

			return { id };
		})
};
