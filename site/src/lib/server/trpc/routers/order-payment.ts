import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { permissionProcedure, protectedProcedure, t } from '../trpc';
import { hasPermission, isAdmin } from '../../auth';

// Statuses where payment info can be sent
const PAYMENT_ALLOWED_STATUSES = ['in_progress', 'testing', 'completed', 'delivered'];

export const orderPaymentRouter = t.router({
	// Get payment info for an order
	getByOrderId: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			// Check if user has permission to view this order's payment info
			const orderResult = await db
				.select()
				.from(schema.orders)
				.where(eq(schema.orders.id, input.orderId))
				.limit(1);
			const order = orderResult[0];
			
			if (!order) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
			}

			// User can view if they are admin, have view_orders permission, or are assigned to the order
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

			// Enrich with provider info
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

	// Send payment info for an order (requires send_payment_info permission)
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
			// Check if order exists and is in a valid status
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

			// Notify the assigned programmer about payment info
			if (order.assignedToId) {
				await notifyProgrammerAboutPayment(order.assignedToId, order.id, order.title);
			}

			// Notify the customer about payment info
			await notifyCustomerAboutPayment(order.customerTelegramId, order.title, input.paymentMethodName, input.paymentDetails, input.totalAmount);

			return { id };
		}),

	// Update payment info
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

	// Delete payment info
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
		}),

	// Get available payment methods (active ones)
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

	// Get commission settings
	getCommissionSettings: permissionProcedure('send_payment_info').query(async () => {
		return await db
			.select()
			.from(schema.commissionSettings)
			.where(eq(schema.commissionSettings.isActive, true))
			.orderBy(schema.commissionSettings.name);
	}),

	// Check if user can send payment info for an order
	canSendPaymentInfo: protectedProcedure
		.input((v) => {
			const s = Type.Object({ orderId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { orderId: string };
		})
		.query(async ({ input, ctx }) => {
			// Check permission
			if (!hasPermission(ctx.user, 'send_payment_info') && !isAdmin(ctx.user)) {
				return false;
			}

			// Check order status
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
});

// Helper function to notify programmer about payment info
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:8081';

async function notifyProgrammerAboutPayment(userId: string, orderId: string, orderTitle: string): Promise<boolean> {
	try {
		const userResult = await db
			.select({ telegramId: schema.users.telegramId })
			.from(schema.users)
			.where(eq(schema.users.id, userId))
			.limit(1);
		const user = userResult[0];

		if (!user?.telegramId) {
			return false;
		}

		const response = await fetch(`${BOT_WEBHOOK_URL}/notify-staff`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'payment_info_sent',
				telegramId: user.telegramId,
				orderTitle,
				orderId
			})
		});

		return response.ok;
	} catch {
		return false;
	}
}

async function notifyCustomerAboutPayment(
	customerTelegramId: string,
	orderTitle: string,
	paymentMethodName: string,
	paymentDetails: string,
	totalAmount: number
): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/notify`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'payment_info_received',
				telegramId: customerTelegramId,
				orderTitle,
				paymentMethodName,
				paymentDetails,
				totalAmount
			})
		});

		return response.ok;
	} catch {
		return false;
	}
}