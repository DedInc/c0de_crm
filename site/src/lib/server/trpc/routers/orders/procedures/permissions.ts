import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { permissionProcedure } from '../../../trpc';
import { notifyUserAboutChatAccess } from '../helpers';

export const grantOrderPermission = permissionProcedure('assign_orders')
	.input((v) => {
		const s = Type.Object({
			orderId: Type.String(),
			userId: Type.String(),
			permission: Type.Literal('chat_customers'),
			expiresAt: Type.Optional(Type.String())
		});
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v))
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as {
			orderId: string;
			userId: string;
			permission: 'chat_customers';
			expiresAt?: string;
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

		const userResult = await db.select().from(schema.users).where(eq(schema.users.id, input.userId)).limit(1);
		const user = userResult[0];
		if (!user) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
		}

		const existingResult = await db
			.select()
			.from(schema.orderPermissions)
			.where(
				and(
					eq(schema.orderPermissions.orderId, input.orderId),
					eq(schema.orderPermissions.userId, input.userId),
					eq(schema.orderPermissions.permission, input.permission)
				)
			)
			.limit(1);

		if (existingResult[0]) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'This permission is already granted for this order'
			});
		}

		const id = crypto.randomUUID();
		await db.insert(schema.orderPermissions)
			.values({
				id,
				orderId: input.orderId,
				userId: input.userId,
				permission: input.permission,
				grantedById: ctx.user!.id,
				expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
				createdAt: new Date()
			});

		if (input.permission === 'chat_customers') {
			await notifyUserAboutChatAccess(input.userId, order.id, order.title);
		}

		return { id };
	});

export const revokeOrderPermission = permissionProcedure('assign_orders')
	.input((v) => {
		const s = Type.Object({
			permissionId: Type.String()
		});
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v))
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { permissionId: string };
	})
	.mutation(async ({ input }) => {
		const permissionResult = await db
			.select()
			.from(schema.orderPermissions)
			.where(eq(schema.orderPermissions.id, input.permissionId))
			.limit(1);

		if (!permissionResult[0]) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Permission not found' });
		}

		await db.delete(schema.orderPermissions)
			.where(eq(schema.orderPermissions.id, input.permissionId));

		return { success: true };
	});

export const getOrderPermissions = permissionProcedure('assign_orders')
	.input((v) => {
		const s = Type.Object({ orderId: Type.String() });
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v))
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { orderId: string };
	})
	.query(async ({ input }) => {
		const permissions = await db
			.select()
			.from(schema.orderPermissions)
			.where(eq(schema.orderPermissions.orderId, input.orderId));

		const result = [];
		for (const p of permissions) {
			const userResult = await db
				.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(eq(schema.users.id, p.userId))
				.limit(1);
			const grantedByResult = await db
				.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(eq(schema.users.id, p.grantedById))
				.limit(1);
			result.push({
				...p,
				user: userResult[0],
				grantedBy: grantedByResult[0]
			});
		}
		return result;
	});
