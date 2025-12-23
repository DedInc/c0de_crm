import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { createUser, updateUserPassword, updateUserTelegramId } from '../../auth';
import { protectedProcedure, permissionProcedure, t } from '../trpc';

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:8081';

/**
 * Validate that a Telegram ID is in the correct format (7-15 digit number)
 */
function isValidTelegramId(telegramId: string | null | undefined): boolean {
	if (!telegramId) return true; // null/undefined/empty is valid (means not linked)
	return /^\d{7,15}$/.test(telegramId);
}

/**
 * Map bot error codes to i18n keys
 */
const ERROR_CODE_TO_I18N: Record<string, string> = {
	'BOT_BLOCKED': 'error.botBlocked',
	'INVALID_TELEGRAM_ID_OR_NOT_STARTED': 'error.invalidTelegramIdOrNotStarted',
	'INVALID_TELEGRAM_ID_FORMAT': 'error.invalidTelegramIdFormat'
};

/**
 * Send a verification message to a Telegram user
 */
async function sendTelegramVerification(telegramId: string): Promise<{ success: boolean; error?: string; errorCode?: string }> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/verify-telegram`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ telegramId })
		});

		const data = await response.json();
		
		if (!response.ok || !data.success) {
			// Return the error code for i18n translation on the client side
			const errorCode = data.errorCode || data.error;
			const i18nKey = ERROR_CODE_TO_I18N[errorCode];
			return {
				success: false,
				error: i18nKey || data.error || 'Failed to send verification message',
				errorCode: errorCode
			};
		}

		return { success: true };
	} catch {
		return { success: false, error: 'error.networkError' };
	}
}

export const usersRouter = t.router({
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
			// Validate Telegram ID format if provided
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
			// Validate Telegram ID format if provided (and not null - null means unlinking)
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
		}),

	updateOwnTelegramId: protectedProcedure
		.input((v) => {
			const s = Type.Object({
				telegramId: Type.Union([Type.String(), Type.Null()])
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string | null };
		})
		.mutation(async ({ input, ctx }) => {
			// Validate Telegram ID format if provided (and not null - null means unlinking)
			if (input.telegramId !== null && !isValidTelegramId(input.telegramId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Telegram ID must be a 7-15 digit number'
				});
			}

			await updateUserTelegramId(ctx.user!.id, input.telegramId);
			return { success: true };
		}),

	verifyAndLinkTelegram: protectedProcedure
		.input((v) => {
			const s = Type.Object({
				telegramId: Type.String({ minLength: 7, maxLength: 10 })
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string };
		})
		.mutation(async ({ input, ctx }) => {
			// Validate that telegramId is numeric
			if (!/^\d{7,10}$/.test(input.telegramId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Telegram ID must be a 7-10 digit number'
				});
			}

			// Check if this Telegram ID is already linked to another user
			const existingUserResult = await db
				.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(eq(schema.users.telegramId, input.telegramId))
				.limit(1);
			const existingUser = existingUserResult[0];

			if (existingUser && existingUser.id !== ctx.user!.id) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'This Telegram ID is already linked to another account'
				});
			}

			// If already linked to current user, no need to verify again
			if (existingUser && existingUser.id === ctx.user!.id) {
				return { success: true, alreadyLinked: true };
			}

			// Send verification message to the Telegram user
			const result = await sendTelegramVerification(input.telegramId);
			
			if (!result.success) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: result.error || 'Failed to verify Telegram ID. Make sure the bot is not blocked and the ID is correct.'
				});
			}

			// If verification successful, update the user's telegram ID
			await updateUserTelegramId(ctx.user!.id, input.telegramId);
			return { success: true };
		}),

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
			// Check if marker already linked
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
			// Get all markers for user, then delete and re-add without the removed one
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
});