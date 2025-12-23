import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { publicProcedure } from '../../trpc';

export const languageProcedures = {
	getUserLanguage: publicProcedure
		.input((v) => {
			const s = Type.Object({ telegramId: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string };
		})
		.query(async ({ input }) => {
			const userResult = await db
				.select()
				.from(schema.telegramUsers)
				.where(eq(schema.telegramUsers.telegramId, input.telegramId))
				.limit(1);
			const user = userResult[0];

			return { language: user?.language || null, exists: !!user };
		}),

	setUserLanguage: publicProcedure
		.input((v) => {
			const s = Type.Object({
				telegramId: Type.String(),
				language: Type.Union([Type.Literal('en'), Type.Literal('ru')])
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { telegramId: string; language: 'en' | 'ru' };
		})
		.mutation(async ({ input }) => {
			const now = new Date();
			const existingResult = await db
				.select()
				.from(schema.telegramUsers)
				.where(eq(schema.telegramUsers.telegramId, input.telegramId))
				.limit(1);
			const existing = existingResult[0];

			if (existing) {
				await db.update(schema.telegramUsers)
					.set({ language: input.language, updatedAt: now })
					.where(eq(schema.telegramUsers.telegramId, input.telegramId));
			} else {
				await db.insert(schema.telegramUsers)
					.values({
						telegramId: input.telegramId,
						language: input.language,
						createdAt: now,
						updatedAt: now
					});
			}

			return { success: true };
		})
};
