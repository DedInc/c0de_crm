import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import {
	validateCredentials,
	createSession,
	deleteSession
} from '../../auth';
import { publicProcedure, protectedProcedure, t } from '../trpc';

export const authRouter = t.router({
	login: publicProcedure
		.input((v) => {
			const schema = Type.Object({
				username: Type.String({ minLength: 1 }),
				password: Type.String({ minLength: 1 })
			});
			const check = TypeCompiler.Compile(schema);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { username: string; password: string };
		})
		.mutation(async ({ input }) => {
			const user = await validateCredentials(input.username, input.password);
			if (!user) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
			}
			const sessionId = await createSession(user.id);
			return { sessionId, user };
		}),

	logout: protectedProcedure.mutation(async ({ ctx }) => {
		if (ctx.sessionId) {
			await deleteSession(ctx.sessionId);
		}
		return { success: true };
	}),

	me: protectedProcedure.query(async ({ ctx }) => {
		return ctx.user;
	})
});