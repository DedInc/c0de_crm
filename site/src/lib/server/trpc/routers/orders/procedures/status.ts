import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { protectedProcedure } from '../../../trpc';
import { hasPermission, isAdmin } from '../../../../auth';
import { notifyCustomer } from '../helpers';

export const updateStatus = protectedProcedure
	.input((v) => {
		const s = Type.Object({
			orderId: Type.String(),
			status: Type.Union([
				Type.Literal('in_progress'),
				Type.Literal('testing'),
				Type.Literal('completed'),
				Type.Literal('delivered')
			])
		});
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { orderId: string; status: 'in_progress' | 'testing' | 'completed' | 'delivered' };
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

		const canUpdate =
			hasPermission(ctx.user, 'update_order_status') ||
			isAdmin(ctx.user) ||
			order.assignedToId === ctx.user!.id;

		if (!canUpdate) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to update this order status'
			});
		}

		const isAssignedProgrammer =
			order.assignedToId === ctx.user!.id &&
			!hasPermission(ctx.user, 'update_order_status') &&
			!isAdmin(ctx.user);

		if (isAssignedProgrammer) {
			const allowedTransitions: Record<string, string[]> = {
				in_progress: ['testing'],
				testing: ['in_progress', 'completed']
			};

			if (!allowedTransitions[order.status]?.includes(input.status)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'You can only move orders between In Progress, Testing, and Completed'
				});
			}
		}

		await db.update(schema.orders)
			.set({ status: input.status, updatedAt: new Date() })
			.where(eq(schema.orders.id, input.orderId));

		await notifyCustomer({
			type: 'order_status_changed',
			telegramId: order.customerTelegramId,
			orderTitle: order.title,
			status: input.status
		});

		return { success: true };
	});
