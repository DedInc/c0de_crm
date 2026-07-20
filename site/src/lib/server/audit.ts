import { db } from './db';
import { auditLogs } from './db/schema';

export type AuditAction =
	| 'user.create' | 'user.update' | 'user.delete' | 'user.password_change'
	| 'role.create' | 'role.update' | 'role.delete'
	| 'role.assign' | 'role.unassign'
	| 'permission.grant' | 'permission.revoke'
	| 'login.success' | 'login.failed'
	| 'payment_info.create' | 'payment_info.update' | 'payment_info.delete';

type DbWriter = Pick<typeof db, 'insert'>;

export async function logAudit(params: {
	userId: string | null;
	action: AuditAction;
	targetType: string;
	targetId?: string;
	details?: Record<string, unknown>;
	ipAddress?: string | null;
	tx?: DbWriter;
}): Promise<void> {
	const writer = params.tx ?? db;
	try {
		await writer.insert(auditLogs).values({
			id: crypto.randomUUID(),
			userId: params.userId,
			action: params.action,
			targetType: params.targetType,
			targetId: params.targetId ?? null,
			details: params.details ?? null,
			ipAddress: params.ipAddress ?? null,
			createdAt: new Date()
		});
	} catch {
		if (params.tx) {
			throw new Error('Audit log write failed inside transaction');
		}
		process.stderr.write('Failed to write audit log\n');
	}
}
