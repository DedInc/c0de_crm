import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { permissionProcedure } from '../../trpc';

export const markerProcedures = {
	addMarker: permissionProcedure('manage_users')
		.input((v) => {
			const s = Type.Object({
				userId: Type.String(),
				markerId: Type.String()
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { userId: string; markerId: string };
		})
		.mutation(async ({ input }) => {
			const existingMarkers = await db
				.select()
				.from(schema.userMarkers)
				.where(eq(schema.userMarkers.userId, input.userId));
			const existing = existingMarkers.find((m: { userId: string; markerId: string }) => m.markerId === input.markerId);
			
			if (existing) {
				throw new TRPCError({ code: 'CONFLICT', message: 'Marker already linked to user' });
			}

			await db.insert(schema.userMarkers)
				.values({
					userId: input.userId,
					markerId: input.markerId
				});
			return { success: true };
		}),

	removeMarker: permissionProcedure('manage_users')
		.input((v) => {
			const s = Type.Object({
				userId: Type.String(),
				markerId: Type.String()
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { userId: string; markerId: string };
		})
		.mutation(async ({ input }) => {
			const currentMarkers = await db
				.select()
				.from(schema.userMarkers)
				.where(eq(schema.userMarkers.userId, input.userId));
			
			await db.delete(schema.userMarkers).where(eq(schema.userMarkers.userId, input.userId));
			
			for (const marker of currentMarkers) {
				if (marker.markerId !== input.markerId) {
					await db.insert(schema.userMarkers)
						.values({
							userId: input.userId,
							markerId: marker.markerId
						});
				}
			}
			return { success: true };
		})
};
