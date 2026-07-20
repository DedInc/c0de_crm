import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import {
	validateCredentials,
	createSession,
	deleteSession
} from '../../auth';
import { publicProcedure, protectedProcedure, t } from '../trpc';
import { checkRateLimit } from '../../rate-limit';
import { logAudit } from '../../audit';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

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
		.mutation(async ({ input, ctx }) => {
			const ip = ctx.clientIp || 'unknown';
			const rateLimitKey = `login:${ip}`;
			const { allowed, retryAfterSeconds } = await checkRateLimit(
				rateLimitKey,
				LOGIN_MAX_ATTEMPTS,
				LOGIN_WINDOW_SECONDS
			);

			if (!allowed) {
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: `Too many login attempts. Try again in ${retryAfterSeconds} seconds.`
				});
			}

			const user = await validateCredentials(input.username, input.password);
			if (!user) {
				await logAudit({ userId: null, action: 'login.failed', targetType: 'user', details: { username: input.username }, ipAddress: ctx.clientIp });
				throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
			}
			const sessionId = await createSession(user.id);

			// Set HttpOnly cookie server-side (F1-1: prevents XSS session hijack)
			ctx.cookies.set('session_id', sessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: ctx.isSecureRequest,
				maxAge: 7 * 24 * 60 * 60
			});

			await logAudit({ userId: user.id, action: 'login.success', targetType: 'user', targetId: user.id, ipAddress: ctx.clientIp });

			return { user, mustChangePassword: user.mustChangePassword };
		}),

	logout: protectedProcedure.mutation(async ({ ctx }) => {
		if (ctx.sessionId) {
			await deleteSession(ctx.sessionId);
		}
		// Clear cookie server-side
		ctx.cookies.delete('session_id', { path: '/' });
		return { success: true };
	}),

	me: protectedProcedure.query(async ({ ctx }) => {
		return ctx.user;
	})
});
