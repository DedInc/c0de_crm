import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { permissionProcedure } from '../../../trpc';
import {
	enrichOrder,
	getOrderMarkers,
	getAssignedUser,
	getOrderResponsesWithUsers,
	getPaymentMethod
} from '../helpers';

export const list = permissionProcedure('view_orders').query(async () => {
	const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
	const result = [];
	for (const order of allOrders) {
		result.push(await enrichOrder(order));
	}
	return result;
});

export const getById = permissionProcedure('view_orders')
	.input((v) => {
		const s = Type.Object({ id: Type.String() });
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { id: string };
	})
	.query(async ({ input }) => {
		const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.id)).limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}

		return {
			...order,
			markers: await getOrderMarkers(order.id),
			assignedTo: await getAssignedUser(order.assignedToId),
			responses: await getOrderResponsesWithUsers(order.id),
			paymentMethodDetails: await getPaymentMethod(order.paymentMethod)
		};
	});
