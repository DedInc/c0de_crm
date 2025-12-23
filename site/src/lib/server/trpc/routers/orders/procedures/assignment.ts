import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { permissionProcedure } from '../../../trpc';
import { notifyCustomer, notifyUserAboutAssignment } from '../helpers';

export const assign = permissionProcedure('assign_orders')
	.input((v) => {
		const s = Type.Object({
			orderId: Type.String(),
			userId: Type.String()
		});
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { orderId: string; userId: string };
	})
	.mutation(async ({ input }) => {
		const orderResult = await db
			.select()
			.from(schema.orders)
			.where(eq(schema.orders.id, input.orderId))
			.limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}

		if (order.assignedToId === input.userId) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'This user is already assigned to this order'
			});
		}

		const userResult = await db.select().from(schema.users).where(eq(schema.users.id, input.userId)).limit(1);
		const user = userResult[0];
		if (!user) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
		}

		const newStatus = order.status === 'approved' ? 'in_progress' : order.status;

		await db.update(schema.orders)
			.set({
				assignedToId: input.userId,
				status: newStatus,
				updatedAt: new Date()
			})
			.where(eq(schema.orders.id, input.orderId));

		if (order.status === 'approved' && !order.assignedToId) {
			await notifyCustomer({
				type: 'order_assigned',
				telegramId: order.customerTelegramId,
				orderTitle: order.title
			});
		}

		await notifyUserAboutAssignment(input.userId, order.id, order.title);

		return { success: true };
	});

export const respond = permissionProcedure('respond_orders')
	.input((v) => {
		const s = Type.Object({
			orderId: Type.String(),
			proposedPrice: Type.Number({ minimum: 0 }),
			message: Type.Optional(Type.String())
		});
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { orderId: string; proposedPrice: number; message?: string };
	})
	.mutation(async ({ input, ctx }) => {
		const orderResult = await db
			.select()
			.from(schema.orders)
			.where(eq(schema.orders.id, input.orderId))
			.limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}
		if (order.status !== 'approved') {
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only respond to approved orders' });
		}
		
		if (order.assignedToId) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Cannot respond to an order that already has an assigned coder'
			});
		}
		
		if (order.cost > 0 && input.proposedPrice > order.cost) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: `Proposed price cannot exceed the order budget of $${order.cost}`
			});
		}

		const existingResponseResult = await db
			.select()
			.from(schema.orderResponses)
			.where(
				and(
					eq(schema.orderResponses.orderId, input.orderId),
					eq(schema.orderResponses.userId, ctx.user!.id)
				)
			)
			.limit(1);

		if (existingResponseResult[0]) {
			throw new TRPCError({ code: 'CONFLICT', message: 'You have already responded to this order' });
		}

		const id = crypto.randomUUID();
		const { notifyAssignersAboutResponse } = await import('../helpers');
		
		await db.insert(schema.orderResponses)
			.values({
				id,
				orderId: input.orderId,
				userId: ctx.user!.id,
				proposedPrice: input.proposedPrice,
				message: input.message || null,
				createdAt: new Date()
			});

		await notifyAssignersAboutResponse(order.id, order.title, ctx.user!.username);

		return { id };
	});
