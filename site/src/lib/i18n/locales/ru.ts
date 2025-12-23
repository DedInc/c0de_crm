import common from './ru/common';
import auth from './ru/auth';
import navigation from './ru/navigation';
import orders from './ru/orders';
import users from './ru/users';
import payment from './ru/payment';
import other from './ru/other';

export default {
	...common,
	...auth,
	...navigation,
	...orders,
	...users,
	...payment,
	...other
} as Record<string, string>;