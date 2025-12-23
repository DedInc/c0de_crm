import { t } from '../trpc';
import { queryProcedures } from './order-payment/query-procedures';
import { mutationProcedures } from './order-payment/mutation-procedures';

export const orderPaymentRouter = t.router({
	...queryProcedures,
	...mutationProcedures
});