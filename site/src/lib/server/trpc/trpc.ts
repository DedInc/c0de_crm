import { initTRPC, TRPCError } from '@trpc/server';
import { hasPermission, isAdmin } from '../auth';
import { isInternalApiKeyConfigured, validateInternalApiKey } from '../internal-auth';
import type { Context } from './context';

export type { Context };

export const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

export const internalProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!isInternalApiKeyConfigured()) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'INTERNAL_API_KEY is not configured'
		});
	}
	if (!validateInternalApiKey(ctx.internalApiKey)) {
		throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid internal API key' });
	}
	return next();
});

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
	}
	return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!isAdmin(ctx.user)) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
	}
	return next();
});

export const permissionProcedure = (permission: string) =>
	protectedProcedure.use(async ({ ctx, next }) => {
		if (!hasPermission(ctx.user, permission) && !isAdmin(ctx.user)) {
			throw new TRPCError({ code: 'FORBIDDEN', message: `Permission '${permission}' required` });
		}
		return next();
	});