import { t } from '../trpc';
import { crudProcedures } from './users/crud-procedures';
import { telegramProcedures } from './users/telegram-procedures';
import { markerProcedures } from './users/marker-procedures';

export const usersRouter = t.router({
	...crudProcedures,
	...telegramProcedures,
	...markerProcedures
});