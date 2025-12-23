import { t } from '../trpc';
import { languageProcedures } from './bot/language-procedures';
import { orderProcedures } from './bot/order-procedures';
import { dataProcedures } from './bot/data-procedures';

export const botRouter = t.router({
	...languageProcedures,
	...orderProcedures,
	...dataProcedures
});