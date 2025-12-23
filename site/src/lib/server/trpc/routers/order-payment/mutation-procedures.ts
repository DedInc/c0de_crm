import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { permissionProcedure } from '../../trpc';
import { PAYMENT_ALLOWED_STATUSES, notifyProgrammerAboutPayment, notifyCustomerAboutPayment } from './helpers';

export const mutationProcedures = {
	sendPaymentInfo: permissionProcedure('send_payment_info')
		.input((v) => {
			const s = Type.Object({
				orderId: Type.String(),
				paymentMethodId: Type.Optional(Type.String()),
				paymentMethodName: Type.String({ minLength: 1 }),
				paymentDetails: Type.String({ minLength: 1 }),
				programmerAmount: Type.Number({ minimum: 0 }),
				commissionAmount: Type.Optional(Type.Number({ minimum: 0 })),
				totalAmount: Type.Number({ minimum: 0 }),
				commissionSettingId: Type.Optional(Type.String())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				orderId: string;
				paymentMethodId?: string;
				paymentMethodName: string;
				paymentDetails: string;
				programmerAmount: number;
				commissionAmount?: number;
				totalAmount: number;
				commissionSettingId?: string;
			};
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

			if (!PAYMENT_ALLOWED_STATUSES.includes(order.status)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Payment info can only be sent for orders in progress or later statuses'
				});
			}

			const id = crypto.randomUUID();
			const now = new Date();

			await db.insert(schema.orderPaymentInfo).values({
				id,
				orderId: input.orderId,
				providedByUserId: ctx.user!.id,
				paymentMethodId: input.paymentMethodId || null,
				paymentMethodName: input.paymentMethodName,
				paymentDetails: input.paymentDetails,
				programmerAmount: input.programmerAmount,
				commissionAmount: input.commissionAmount || 0,
				totalAmount: input.totalAmount,
				commissionSettingId: input.commissionSettingId || null,
				createdAt: now,
				updatedAt: now
			});

			if (order.assignedToId) {
				await notifyProgrammerAboutPayment(order.assignedToId, order.id, order.title);
			}

			await notifyCustomerAboutPayment(order.customerTelegramId, order.title, input.paymentMethodName, input.paymentDetails, input.totalAmount);

			return { id };
		}),

	updatePaymentInfo: permissionProcedure('send_payment_info')
		.input((v) => {
			const s = Type.Object({
				id: Type.String(),
				paymentMethodId: Type.Optional(Type.String()),
				paymentMethodName: Type.Optional(Type.String({ minLength: 1 })),
				paymentDetails: Type.Optional(Type.String({ minLength: 1 })),
				programmerAmount: Type.Optional(Type.Number({ minimum: 0 })),
				commissionAmount: Type.Optional(Type.Number({ minimum: 0 })),
				totalAmount: Type.Optional(Type.Number({ minimum: 0 })),
				commissionSettingId: Type.Optional(Type.String())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				id: string;
				paymentMethodId?: string;
				paymentMethodName?: string;
				paymentDetails?: string;
				programmerAmount?: number;
				commissionAmount?: number;
				totalAmount?: number;
				commissionSettingId?: string;
			};
		})
		.mutation(async ({ input }) => {
			const existing = await db
				.select()
				.from(schema.orderPaymentInfo)
				.where(eq(schema.orderPaymentInfo.id, input.id))
				.limit(1);

			if (!existing[0]) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment info not found' });
			}

			const updateData: Partial<schema.OrderPaymentInfo> = {
				updatedAt: new Date()
			};

			if (input.paymentMethodId !== undefined) updateData.paymentMethodId = input.paymentMethodId;
			if (input.paymentMethodName !== undefined) updateData.paymentMethodName = input.paymentMethodName;
			if (input.paymentDetails !== undefined) updateData.paymentDetails = input.paymentDetails;
			if (input.programmerAmount !== undefined) updateData.programmerAmount = input.programmerAmount;
			if (input.commissionAmount !== undefined) updateData.commissionAmount = input.commissionAmount;
			if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount;
			if (input.commissionSettingId !== undefined) updateData.commissionSettingId = input.commissionSettingId;

			await db
				.update(schema.orderPaymentInfo)
				.set(updateData)
				.where(eq(schema.orderPaymentInfo.id, input.id));

			return { success: true };
		}),

	deletePaymentInfo: permissionProcedure('send_payment_info')
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input }) => {
			const existing = await db
				.select()
				.from(schema.orderPaymentInfo)
				.where(eq(schema.orderPaymentInfo.id, input.id))
				.limit(1);

			if (!existing[0]) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment info not found' });
			}

			await db.delete(schema.orderPaymentInfo).where(eq(schema.orderPaymentInfo.id, input.id));

			return { success: true };
		})
};
