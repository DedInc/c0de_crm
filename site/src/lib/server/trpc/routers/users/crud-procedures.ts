import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { createUser, updateUserPassword, updateUserTelegramId } from '../../../auth';
import { permissionProcedure } from '../../trpc';
import { isValidTelegramId } from './validation';

export const crudProcedures = {
	list: permissionProcedure('manage_users').query(async () => {
		const allUsers = await db.select().from(schema.users);
		const result = [];

		for (const user of allUsers) {
			const userRolesList = await db
				.select({ roleId: schema.userRoles.roleId, roleName: schema.roles.name })
				.from(schema.userRoles)
				.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
				.where(eq(schema.userRoles.userId, user.id));

			const markers = await db
				.select({
					id: schema.stackMarkers.id,
					name: schema.stackMarkers.name,
					color: schema.stackMarkers.color
				})
				.from(schema.userMarkers)
				.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
				.where(eq(schema.userMarkers.userId, user.id));

			result.push({
				id: user.id,
				username: user.username,
				telegramId: user.telegramId,
				createdAt: user.createdAt,
				roles: userRolesList,
				markers
			});
		}

		return result;
	}),

	create: permissionProcedure('manage_users')
		.input((v) => {
			const s = Type.Object({
				username: Type.String({ minLength: 1 }),
				password: Type.String({ minLength: 6 }),
				roleIds: Type.Array(Type.String()),
				telegramId: Type.Optional(Type.String()),
				markerIds: Type.Optional(Type.Array(Type.String()))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				username: string;
				password: string;
				roleIds: string[];
				telegramId?: string;
				markerIds?: string[];
			};
		})
		.mutation(async ({ input }) => {
			if (input.telegramId && !isValidTelegramId(input.telegramId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Telegram ID must be a 7-15 digit number'
				});
			}

			const existingResult = await db
				.select()
				.from(schema.users)
				.where(eq(schema.users.username, input.username))
				.limit(1);
			if (existingResult[0]) {
				throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' });
			}

			const userId = await createUser(
				input.username,
				input.password,
				input.roleIds,
				input.telegramId
			);

			if (input.markerIds) {
				for (const markerId of input.markerIds) {
					await db.insert(schema.userMarkers)
						.values({
							userId,
							markerId
						});
				}
			}

			return { id: userId };
		}),

	update: permissionProcedure('manage_users')
		.input((v) => {
			const s = Type.Object({
				id: Type.String(),
				username: Type.Optional(Type.String({ minLength: 1 })),
				password: Type.Optional(Type.String({ minLength: 6 })),
				roleIds: Type.Optional(Type.Array(Type.String())),
				telegramId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
				markerIds: Type.Optional(Type.Array(Type.String()))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				id: string;
				username?: string;
				password?: string;
				roleIds?: string[];
				telegramId?: string | null;
				markerIds?: string[];
			};
		})
		.mutation(async ({ input }) => {
			if (input.telegramId !== undefined && input.telegramId !== null && !isValidTelegramId(input.telegramId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Telegram ID must be a 7-15 digit number'
				});
			}

			const userResult = await db.select().from(schema.users).where(eq(schema.users.id, input.id)).limit(1);
			const user = userResult[0];
			if (!user) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
			}

			if (input.username && input.username !== user.username) {
				const existingResult = await db
					.select()
					.from(schema.users)
					.where(eq(schema.users.username, input.username))
					.limit(1);
				if (existingResult[0]) {
					throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' });
				}
				await db.update(schema.users)
					.set({ username: input.username, updatedAt: new Date() })
					.where(eq(schema.users.id, input.id));
			}

			if (input.password) {
				await updateUserPassword(input.id, input.password);
			}

			if (input.telegramId !== undefined) {
				await updateUserTelegramId(input.id, input.telegramId);
			}

			if (input.roleIds) {
				await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, input.id));
				for (const roleId of input.roleIds) {
					await db.insert(schema.userRoles).values({ userId: input.id, roleId });
				}
			}

			if (input.markerIds !== undefined) {
				await db.delete(schema.userMarkers).where(eq(schema.userMarkers.userId, input.id));
				for (const markerId of input.markerIds) {
					await db.insert(schema.userMarkers)
						.values({
							userId: input.id,
							markerId
						});
				}
			}

			return { success: true };
		}),

	delete: permissionProcedure('manage_users')
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input, ctx }) => {
			if (input.id === ctx.user?.id) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete yourself' });
			}
			await db.delete(schema.users).where(eq(schema.users.id, input.id));
			return { success: true };
		})
};
