import { initTRPC, TRPCError } from '@trpc/server';
import { hasPermission, isAdmin, type AuthUser } from '../auth';

export interface Context {
	user: AuthUser | null;
	sessionId: string | null;
}

export const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

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