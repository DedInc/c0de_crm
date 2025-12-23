import { t } from './trpc';
import {
	authRouter,
	usersRouter,
	rolesRouter,
	permissionsRouter,
	markersRouter,
	ordersRouter,
	chatRouter,
	botRouter,
	paymentMethodsRouter,
	orderPaymentRouter
} from './routers';

export const appRouter = t.router({
	auth: authRouter,
	users: usersRouter,
	roles: rolesRouter,
	permissions: permissionsRouter,
	markers: markersRouter,
	orders: ordersRouter,
	chat: chatRouter,
	bot: botRouter,
	paymentMethods: paymentMethodsRouter,
	orderPayment: orderPaymentRouter
});

export type AppRouter = typeof appRouter;