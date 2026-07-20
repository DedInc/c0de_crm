import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({
	db: {}
}));

vi.mock('./db/schema', () => ({}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

vi.mock('bcryptjs', () => ({
	compareSync: vi.fn(),
	hashSync: vi.fn()
}));

const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = await import('./auth');

const baseUser = {
	id: 'user-1',
	username: 'alice',
	telegramId: null,
	permissions: ['view_orders'],
	roles: ['Programmer'],
	mustChangePassword: false
};

describe('hasPermission', () => {
	it('returns false for null users', () => {
		expect(hasPermission(null, 'view_orders')).toBe(false);
	});

	it('returns true when the permission matches a granted permission', () => {
		expect(hasPermission(baseUser, 'view_orders')).toBe(true);
	});

	it('returns false when the permission is missing', () => {
		expect(hasPermission(baseUser, 'manage_users')).toBe(false);
	});
});

describe('hasAnyPermission / hasAllPermissions', () => {
	it('hasAnyPermission accepts a single match', () => {
		expect(hasAnyPermission(baseUser, ['manage_users', 'view_orders'])).toBe(true);
		expect(hasAnyPermission(baseUser, ['manage_users'])).toBe(false);
		expect(hasAnyPermission(null, ['view_orders'])).toBe(false);
	});

	it('hasAllPermissions requires every permission', () => {
		expect(hasAllPermissions(baseUser, ['view_orders'])).toBe(true);
		expect(hasAllPermissions(baseUser, ['view_orders', 'manage_users'])).toBe(false);
		expect(hasAllPermissions(null, ['view_orders'])).toBe(false);
	});
});

describe('isAdmin', () => {
	it('returns true only when the user has the Administrator role', () => {
		expect(isAdmin(baseUser)).toBe(false);
		expect(isAdmin({ ...baseUser, roles: ['Administrator'] })).toBe(true);
		expect(isAdmin(null)).toBe(false);
	});
});
