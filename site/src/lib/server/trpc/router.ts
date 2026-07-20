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
	orderPaymentRouter,
	auditRouter,
	currencyRouter
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
	orderPayment: orderPaymentRouter,
	audit: auditRouter,
	currency: currencyRouter
});

export type AppRouter = typeof appRouter;