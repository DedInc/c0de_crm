import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, desc, inArray, asc } from 'drizzle-orm';
import { publicProcedure, t } from '../trpc';
import { notifyNewMessage } from '../../sse/chat-connections';
import { notifyModeratorsAboutNewOrder } from './orders/helpers';

export const botRouter = t.router({
	// Get user language preference
	getUserLanguage: publicProcedure
		.input((v) => {
			const s = Type.Object({ telegramId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string };
		})
		.query(async ({ input }) => {
			const userResult = await db
				.select()
				.from(schema.telegramUsers)
				.where(eq(schema.telegramUsers.telegramId, input.telegramId))
				.limit(1);
			const user = userResult[0];

			return { language: user?.language || null, exists: !!user };
		}),

	// Set user language preference
	setUserLanguage: publicProcedure
		.input((v) => {
			const s = Type.Object({
				telegramId: Type.String(),
				language: Type.Union([Type.Literal('en'), Type.Literal('ru')])
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string; language: 'en' | 'ru' };
		})
		.mutation(async ({ input }) => {
			const now = new Date();
			const existingResult = await db
				.select()
				.from(schema.telegramUsers)
				.where(eq(schema.telegramUsers.telegramId, input.telegramId))
				.limit(1);
			const existing = existingResult[0];

			if (existing) {
				await db.update(schema.telegramUsers)
					.set({ language: input.language, updatedAt: now })
					.where(eq(schema.telegramUsers.telegramId, input.telegramId));
			} else {
				await db.insert(schema.telegramUsers)
					.values({
						telegramId: input.telegramId,
						language: input.language,
						createdAt: now,
						updatedAt: now
					});
			}

			return { success: true };
		}),

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
			// Check if customer has less than 2 open orders
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

			await db.insert(schema.orders)
				.values({
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
					await db.insert(schema.orderMarkers)
						.values({
							orderId,
							markerId
						});
				}
			}

			// Notify moderators about the new order for moderation
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
			// Validate that at least message or imageUrls is provided
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
			
			await db.insert(schema.chatMessages)
				.values({
					id,
					orderId: input.orderId,
					senderId: null,
					senderType: 'customer',
					message: input.message || '',
					imageUrls: imageUrlsJson,
					createdAt
				});

			// Notify SSE connections about the new message
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
			
			// Only allow deletion of orders in certain statuses
			const deletableStatuses = ['pending_moderation', 'rejected'];
			if (!deletableStatuses.includes(order.status)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot delete order in current status. Only pending or rejected orders can be deleted.'
				});
			}

			// Delete related records first
			await db.delete(schema.orderMarkers).where(eq(schema.orderMarkers.orderId, input.orderId));
			await db.delete(schema.chatMessages).where(eq(schema.chatMessages.orderId, input.orderId));
			await db.delete(schema.orderResponses).where(eq(schema.orderResponses.orderId, input.orderId));
			
			// Delete the order
			await db.delete(schema.orders).where(eq(schema.orders.id, input.orderId));

			return { success: true };
		}),

	getMarkers: publicProcedure.query(async () => {
		return await db.select().from(schema.stackMarkers);
	}),

	// Get active payment methods for order creation
	getPaymentMethods: publicProcedure.query(async () => {
		return await db
			.select({
				id: schema.paymentMethods.id,
				name: schema.paymentMethods.name,
				details: schema.paymentMethods.details
			})
			.from(schema.paymentMethods)
			.where(eq(schema.paymentMethods.isActive, true))
			.orderBy(asc(schema.paymentMethods.sortOrder));
	}),

	// Get programmers with telegram IDs for notifications
	getProgrammersForNotification: publicProcedure.query(async () => {
		const programmers = await db
			.select({
				userId: schema.users.id,
				username: schema.users.username,
				telegramId: schema.users.telegramId
			})
			.from(schema.users)
			.innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
			.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
			.where(eq(schema.roles.name, 'Programmer'));

		return programmers.filter((p: { userId: string; username: string; telegramId: string | null }) => p.telegramId);
	})
});