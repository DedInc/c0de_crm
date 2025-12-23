import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { publicProcedure, permissionProcedure, t } from '../trpc';

export const markersRouter = t.router({
	list: publicProcedure.query(async () => {
		return await db.select().from(schema.stackMarkers);
	}),

	create: permissionProcedure('manage_markers')
		.input((v) => {
			const s = Type.Object({
				name: Type.String({ minLength: 1 }),
				color: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' })
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { name: string; color: string };
		})
		.mutation(async ({ input }) => {
			const existingResult = await db
				.select()
				.from(schema.stackMarkers)
				.where(eq(schema.stackMarkers.name, input.name))
				.limit(1);
			if (existingResult[0]) {
				throw new TRPCError({ code: 'CONFLICT', message: 'Marker name already exists' });
			}

			const id = crypto.randomUUID();
			await db.insert(schema.stackMarkers)
				.values({
					id,
					name: input.name,
					color: input.color,
					createdAt: new Date()
				});

			return { id };
		}),

	update: permissionProcedure('manage_markers')
		.input((v) => {
			const s = Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String({ minLength: 1 })),
				color: Type.Optional(Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string; name?: string; color?: string };
		})
		.mutation(async ({ input }) => {
			const markerResult = await db
				.select()
				.from(schema.stackMarkers)
				.where(eq(schema.stackMarkers.id, input.id))
				.limit(1);
			const marker = markerResult[0];
			if (!marker) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Marker not found' });
			}

			await db.update(schema.stackMarkers)
				.set({
					name: input.name || marker.name,
					color: input.color || marker.color
				})
				.where(eq(schema.stackMarkers.id, input.id));

			return { success: true };
		}),

	delete: permissionProcedure('manage_markers')
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input }) => {
			await db.delete(schema.stackMarkers).where(eq(schema.stackMarkers.id, input.id));
			return { success: true };
		})
});