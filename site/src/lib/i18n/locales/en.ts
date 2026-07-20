import common from './en/common';
import auth from './en/auth';
import navigation from './en/navigation';
import orders from './en/orders';
import users from './en/users';
import payment from './en/payment';
import other from './en/other';
import audit from './en/audit';

export default {
	...common,
	...auth,
	...navigation,
	...orders,
	...users,
	...payment,
	...other,
	...audit
} as Record<string, string>;