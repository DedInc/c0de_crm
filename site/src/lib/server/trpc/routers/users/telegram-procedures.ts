import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { updateUserTelegramId } from '../../../auth';
import { protectedProcedure } from '../../trpc';
import { isValidTelegramId } from './validation';

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:8081';

const ERROR_CODE_TO_I18N: Record<string, string> = {
	'BOT_BLOCKED': 'error.botBlocked',
	'INVALID_TELEGRAM_ID_OR_NOT_STARTED': 'error.invalidTelegramIdOrNotStarted',
	'INVALID_TELEGRAM_ID_FORMAT': 'error.invalidTelegramIdFormat'
};

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

export const telegramProcedures = {
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
			if (!/^\d{7,10}$/.test(input.telegramId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Telegram ID must be a 7-10 digit number'
				});
			}

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

			if (existingUser && existingUser.id === ctx.user!.id) {
				return { success: true, alreadyLinked: true };
			}

			const result = await sendTelegramVerification(input.telegramId);
			
			if (!result.success) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: result.error || 'Failed to verify Telegram ID. Make sure the bot is not blocked and the ID is correct.'
				});
			}

			await updateUserTelegramId(ctx.user!.id, input.telegramId);
			return { success: true };
		})
};
