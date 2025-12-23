import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { permissionProcedure, protectedProcedure } from '../../trpc';
import { hasPermission, isAdmin } from '../../../auth';
import { PAYMENT_ALLOWED_STATUSES } from './helpers';

export const queryProcedures = {
	getByOrderId: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			const orderResult = await db
				.select()
				.from(schema.orders)
				.where(eq(schema.orders.id, input.orderId))
				.limit(1);
			const order = orderResult[0];
			
			if (!order) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
			}

			const canView = isAdmin(ctx.user) || 
				hasPermission(ctx.user, 'view_orders') || 
				order.assignedToId === ctx.user?.id;

			if (!canView) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this payment info' });
			}

			const paymentInfo = await db
				.select()
				.from(schema.orderPaymentInfo)
				.where(eq(schema.orderPaymentInfo.orderId, input.orderId))
				.orderBy(desc(schema.orderPaymentInfo.createdAt));

			const result = [];
			for (const info of paymentInfo) {
				const providerResult = await db
					.select({ id: schema.users.id, username: schema.users.username })
					.from(schema.users)
					.where(eq(schema.users.id, info.providedByUserId))
					.limit(1);
				
				result.push({
					...info,
					providedBy: providerResult[0] || null
				});
			}

			return result;
		}),

	getPaymentMethods: protectedProcedure.query(async () => {
		return await db
			.select({
				id: schema.paymentMethods.id,
				name: schema.paymentMethods.name
			})
			.from(schema.paymentMethods)
			.where(eq(schema.paymentMethods.isActive, true))
			.orderBy(schema.paymentMethods.sortOrder);
	}),

	getCommissionSettings: permissionProcedure('send_payment_info').query(async () => {
		return await db
			.select()
			.from(schema.commissionSettings)
			.where(eq(schema.commissionSettings.isActive, true))
			.orderBy(schema.commissionSettings.name);
	}),

	canSendPaymentInfo: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			if (!hasPermission(ctx.user, 'send_payment_info') && !isAdmin(ctx.user)) {
				return false;
			}

			const orderResult = await db
				.select({ status: schema.orders.status })
				.from(schema.orders)
				.where(eq(schema.orders.id, input.orderId))
				.limit(1);
			const order = orderResult[0];

			if (!order) {
				return false;
			}

			return PAYMENT_ALLOWED_STATUSES.includes(order.status);
		})
};
