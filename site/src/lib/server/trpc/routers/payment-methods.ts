import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, asc } from 'drizzle-orm';
import { adminProcedure, protectedProcedure, t } from '../trpc';

export const paymentMethodsRouter = t.router({
	// List all payment methods (for admin management)
	list: adminProcedure.query(async () => {
		return await db
			.select()
			.from(schema.paymentMethods)
			.orderBy(asc(schema.paymentMethods.sortOrder));
	}),

	// List active payment methods (for order creation in bot)
	listActive: protectedProcedure.query(async () => {
		return await db
			.select()
			.from(schema.paymentMethods)
			.where(eq(schema.paymentMethods.isActive, true))
			.orderBy(asc(schema.paymentMethods.sortOrder));
	}),

	// Get a single payment method by ID
	getById: protectedProcedure
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.query(async ({ input }) => {
			const result = await db
				.select()
				.from(schema.paymentMethods)
				.where(eq(schema.paymentMethods.id, input.id))
				.limit(1);
			
			if (!result[0]) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment method not found' });
			}
			
			return result[0];
		}),

	// Create a new payment method (details field is now optional/legacy)
	create: adminProcedure
		.input((v) => {
			const s = Type.Object({
				name: Type.String({ minLength: 1 }),
				details: Type.Optional(Type.String()), // Legacy field - no longer required
				isActive: Type.Optional(Type.Boolean()),
				sortOrder: Type.Optional(Type.Number())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { name: string; details?: string; isActive?: boolean; sortOrder?: number };
		})
		.mutation(async ({ input }) => {
			const id = crypto.randomUUID();
			const now = new Date();

			await db.insert(schema.paymentMethods).values({
				id,
				name: input.name,
				details: input.details || '', // Default to empty string
				isActive: input.isActive ?? true,
				sortOrder: input.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now
			});

			return { id };
		}),

	// Update an existing payment method
	update: adminProcedure
		.input((v) => {
			const s = Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String({ minLength: 1 })),
				details: Type.Optional(Type.String()), // Legacy field - no longer required
				isActive: Type.Optional(Type.Boolean()),
				sortOrder: Type.Optional(Type.Number())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string; name?: string; details?: string; isActive?: boolean; sortOrder?: number };
		})
		.mutation(async ({ input }) => {
			const existing = await db
				.select()
				.from(schema.paymentMethods)
				.where(eq(schema.paymentMethods.id, input.id))
				.limit(1);

			if (!existing[0]) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment method not found' });
			}

			const updateData: Partial<schema.PaymentMethod> = {
				updatedAt: new Date()
			};

			if (input.name !== undefined) updateData.name = input.name;
			if (input.details !== undefined) updateData.details = input.details;
			if (input.isActive !== undefined) updateData.isActive = input.isActive;
			if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

			await db
				.update(schema.paymentMethods)
				.set(updateData)
				.where(eq(schema.paymentMethods.id, input.id));

			return { success: true };
		}),

	// Delete a payment method
	delete: adminProcedure
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input }) => {
			const existing = await db
				.select()
				.from(schema.paymentMethods)
				.where(eq(schema.paymentMethods.id, input.id))
				.limit(1);

			if (!existing[0]) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment method not found' });
			}

			await db.delete(schema.paymentMethods).where(eq(schema.paymentMethods.id, input.id));

			return { success: true };
		})
});