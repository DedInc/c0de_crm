import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { permissionProcedure } from '../../../trpc';
import { notifyCustomer, enrichOrderWithMarkers } from '../helpers';

const idInputSchema = Type.Object({ id: Type.String() });
const idInputChecker = TypeCompiler.Compile(idInputSchema);

export const listPendingModeration = permissionProcedure('moderate_orders').query(async () => {
	const orders = await db
		.select()
		.from(schema.orders)
		.where(eq(schema.orders.status, 'pending_moderation'))
		.orderBy(desc(schema.orders.createdAt));

	const result = [];
	for (const order of orders) {
		result.push(await enrichOrderWithMarkers(order));
	}
	return result;
});

export const approve = permissionProcedure('moderate_orders')
	.input((v) => {
		if (!idInputChecker.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { id: string };
	})
	.mutation(async ({ input }) => {
		const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.id)).limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}
		if (order.status !== 'pending_moderation') {
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order is not pending moderation' });
		}

		await db.update(schema.orders)
			.set({ status: 'approved', updatedAt: new Date() })
			.where(eq(schema.orders.id, input.id));

		await notifyCustomer({
			type: 'order_approved',
			telegramId: order.customerTelegramId,
			orderTitle: order.title
		});

		return { success: true };
	});

export const reject = permissionProcedure('moderate_orders')
	.input((v) => {
		if (!idInputChecker.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { id: string };
	})
	.mutation(async ({ input }) => {
		const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.id)).limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}
		if (order.status !== 'pending_moderation') {
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order is not pending moderation' });
		}

		await db.update(schema.orders)
			.set({ status: 'rejected', updatedAt: new Date() })
			.where(eq(schema.orders.id, input.id));

		await notifyCustomer({
			type: 'order_rejected',
			telegramId: order.customerTelegramId,
			orderTitle: order.title
		});

		return { success: true };
	});
