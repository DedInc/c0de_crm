import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { permissionProcedure } from '../../trpc';
import { isValidTelegramId } from './validation';
import { logAudit } from '../../../audit';

export const crudProcedures = {
	list: permissionProcedure('manage_users').query(async () => {
		const allUsers = await db.select().from(schema.users);
		if (allUsers.length === 0) return [];

		const userIds = allUsers.map((u) => u.id);

		const allRoles = await db
			.select({
				userId: schema.userRoles.userId,
				roleId: schema.userRoles.roleId,
				roleName: schema.roles.name
			})
			.from(schema.userRoles)
			.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
			.where(sql`${schema.userRoles.userId} IN ${userIds}`);

		const allMarkers = await db
			.select({
				userId: schema.userMarkers.userId,
				id: schema.stackMarkers.id,
				name: schema.stackMarkers.name,
				color: schema.stackMarkers.color
			})
			.from(schema.userMarkers)
			.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
			.where(sql`${schema.userMarkers.userId} IN ${userIds}`);

		const rolesByUser = new Map<string, Array<{ roleId: string; roleName: string }>>();
		for (const r of allRoles) {
			if (!rolesByUser.has(r.userId)) rolesByUser.set(r.userId, []);
			rolesByUser.get(r.userId)!.push({ roleId: r.roleId, roleName: r.roleName });
		}

		const markersByUser = new Map<string, Array<{ id: string; name: string; color: string }>>();
		for (const m of allMarkers) {
			if (!markersByUser.has(m.userId)) markersByUser.set(m.userId, []);
			markersByUser.get(m.userId)!.push({ id: m.id, name: m.name, color: m.color });
		}

		return allUsers.map((user) => ({
			id: user.id,
			username: user.username,
			telegramId: user.telegramId,
			createdAt: user.createdAt,
			roles: rolesByUser.get(user.id) ?? [],
			markers: markersByUser.get(user.id) ?? []
		}));
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
		.mutation(async ({ input, ctx }) => {
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

			const userId = crypto.randomUUID();
			const now = new Date();

			await db.transaction(async (tx) => {
				await tx.insert(schema.users).values({
					id: userId,
					username: input.username,
					passwordHash: hashSync(input.password, 10),
					telegramId: input.telegramId || null,
					mustChangePassword: true,
					createdAt: now,
					updatedAt: now
				});

				for (const roleId of input.roleIds) {
					await tx.insert(schema.userRoles).values({ userId, roleId });
				}

				if (input.markerIds) {
					for (const markerId of input.markerIds) {
						await tx.insert(schema.userMarkers).values({
							userId,
							markerId
						});
					}
				}

				await logAudit({
					userId: ctx.user!.id,
					action: 'user.create',
					targetType: 'user',
					targetId: userId,
					details: { username: input.username },
					ipAddress: ctx.clientIp,
					tx
				});
			});

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
		.mutation(async ({ input, ctx }) => {
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
			}

			await db.transaction(async (tx) => {
				const userUpdates: Partial<typeof schema.users.$inferInsert> = {};
				if (input.username && input.username !== user.username) {
					userUpdates.username = input.username;
				}
				if (input.password) {
					userUpdates.passwordHash = hashSync(input.password, 10);
					userUpdates.mustChangePassword = false;
				}
				if (input.telegramId !== undefined) {
					userUpdates.telegramId = input.telegramId;
				}
				if (Object.keys(userUpdates).length > 0) {
					await tx.update(schema.users)
						.set({ ...userUpdates, updatedAt: new Date() })
						.where(eq(schema.users.id, input.id));
				}

				if (input.password) {
					await tx.delete(schema.sessions).where(eq(schema.sessions.userId, input.id));
				}

				if (input.roleIds) {
					await tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, input.id));
					for (const roleId of input.roleIds) {
						await tx.insert(schema.userRoles).values({ userId: input.id, roleId });
					}
				}

				if (input.markerIds !== undefined) {
					await tx.delete(schema.userMarkers).where(eq(schema.userMarkers.userId, input.id));
					for (const markerId of input.markerIds) {
						await tx.insert(schema.userMarkers).values({
							userId: input.id,
							markerId
						});
					}
				}

				if (input.roleIds) {
					await logAudit({
						userId: ctx.user!.id,
						action: 'role.assign',
						targetType: 'user',
						targetId: input.id,
						details: { roleIds: input.roleIds },
						ipAddress: ctx.clientIp,
						tx
					});
				}
			});

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
			await db.transaction(async (tx) => {
				await tx.delete(schema.users).where(eq(schema.users.id, input.id));
				await logAudit({
					userId: ctx.user!.id,
					action: 'user.delete',
					targetType: 'user',
					targetId: input.id,
					ipAddress: ctx.clientIp,
					tx
				});
			});
			return { success: true };
		})
};
