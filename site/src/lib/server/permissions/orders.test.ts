import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => {
	const state = { rows: [] as unknown[] };
	const limit = vi.fn(() => Promise.resolve(state.rows));
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const deleteWhere = vi.fn(() => Promise.resolve());
	const deleteFrom = vi.fn(() => ({ where: deleteWhere }));

	return {
		state,
		select,
		from,
		where,
		limit,
		deleteFrom,
		deleteWhere,
		db: {
			select,
			delete: deleteFrom
		}
	};
});

vi.mock('$lib/server/db', () => ({ db: dbMock.db }));
vi.mock('$lib/server/db/schema', () => ({
	orderPermissions: {
		id: { name: 'id' },
		orderId: { name: 'order_id' },
		userId: { name: 'user_id' },
		permission: { name: 'permission' }
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((column, value) => ({ column, value })),
	and: vi.fn((...clauses) => ({ and: clauses }))
}));

const { hasOrderChatPermission } = await import('./orders');

describe('hasOrderChatPermission', () => {
	beforeEach(() => {
		dbMock.state.rows = [];
		dbMock.deleteWhere.mockClear();
	});

	it('returns false when no row is found', async () => {
		dbMock.state.rows = [];
		expect(await hasOrderChatPermission('user-1', 'order-1')).toBe(false);
	});

	it('returns true when an unexpired permission row exists', async () => {
		dbMock.state.rows = [{ id: 'perm-1', expiresAt: null }];
		expect(await hasOrderChatPermission('user-1', 'order-1')).toBe(true);
	});

	it('expires the row when expiresAt is in the past and returns false', async () => {
		dbMock.state.rows = [
			{ id: 'perm-1', expiresAt: new Date(Date.now() - 1000) }
		];
		expect(await hasOrderChatPermission('user-1', 'order-1')).toBe(false);
		expect(dbMock.deleteWhere).toHaveBeenCalled();
	});

	it('returns true when expiresAt is in the future', async () => {
		dbMock.state.rows = [
			{ id: 'perm-1', expiresAt: new Date(Date.now() + 60_000) }
		];
		expect(await hasOrderChatPermission('user-1', 'order-1')).toBe(true);
		expect(dbMock.deleteWhere).not.toHaveBeenCalled();
	});
});
