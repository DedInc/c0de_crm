import { t } from '../../trpc';
import * as queries from './procedures/queries';
import * as moderation from './procedures/moderation';
import * as assignment from './procedures/assignment';
import * as status from './procedures/status';
import * as permissions from './procedures/permissions';

export const ordersRouter = t.router({
	list: queries.list,
	getById: queries.getById,
	listPendingModeration: moderation.listPendingModeration,
	approve: moderation.approve,
	reject: moderation.reject,
	assign: assignment.assign,
	respond: assignment.respond,
	updateStatus: status.updateStatus,
	grantOrderPermission: permissions.grantOrderPermission,
	revokeOrderPermission: permissions.revokeOrderPermission,
	getOrderPermissions: permissions.getOrderPermissions
});