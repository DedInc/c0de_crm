import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import type { AuthUser } from '$lib/server/auth';

const mocks = vi.hoisted(() => ({
	validateSessionForChatStream: vi.fn(),
	hasOrderChatPermission: vi.fn(),
	tryAddConnection: vi.fn(),
	removeConnection: vi.fn(),
	refreshClusterLease: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	validateSessionForChatStream: mocks.validateSessionForChatStream,
	hasPermission: (user: AuthUser | null, perm: string) => !!user?.permissions.includes(perm),
	isAdmin: (user: AuthUser | null) => !!user?.roles.includes('Administrator')
}));

vi.mock('$lib/server/permissions/orders', () => ({
	hasOrderChatPermission: mocks.hasOrderChatPermission
}));

vi.mock('$lib/server/sse/chat-connections', () => ({
	tryAddConnection: mocks.tryAddConnection,
	removeConnection: mocks.removeConnection,
	refreshClusterLease: mocks.refreshClusterLease,
	HEARTBEAT_INTERVAL: 15000
}));

const STAFF_USER: AuthUser = {
	id: 'staff-1',
	username: 'staff',
	telegramId: null,
	permissions: ['chat_customers'],
	roles: [],
	mustChangePassword: false
};

function cookiesWith(sessionId?: string) {
	return {
		get(name: string) {
			return name === 'session_id' ? sessionId : undefined;
		}
	};
}

function eventArgs(orderId: string | null, sessionId?: string) {
	const params = new URLSearchParams();
	if (orderId !== null) params.set('orderId', orderId);
	const url = new URL(`http://localhost/api/chat/events?${params.toString()}`);
	return {
		url,
		cookies: cookiesWith(sessionId)
	} as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/chat/events security', () => {
	beforeEach(() => {
		mocks.validateSessionForChatStream.mockReset();
		mocks.hasOrderChatPermission.mockReset();
		mocks.tryAddConnection.mockReset();
		mocks.removeConnection.mockReset();
		mocks.refreshClusterLease.mockReset();

		mocks.tryAddConnection.mockResolvedValue(true);
	});

	it('rejects requests without an orderId', async () => {
		const response = await GET(eventArgs(null));
		expect(response.status).toBe(400);
		expect(mocks.tryAddConnection).not.toHaveBeenCalled();
	});

	it('rejects unauthenticated requests', async () => {
		const response = await GET(eventArgs('order-1'));
		expect(response.status).toBe(401);
		expect(mocks.tryAddConnection).not.toHaveBeenCalled();
	});

	it('rejects sessions that fail validation', async () => {
		mocks.validateSessionForChatStream.mockResolvedValueOnce(null);
		const response = await GET(eventArgs('order-1', 'session-1'));
		expect(response.status).toBe(401);
		expect(mocks.tryAddConnection).not.toHaveBeenCalled();
	});

	it('rejects users without chat permission', async () => {
		mocks.validateSessionForChatStream.mockResolvedValueOnce({
			...STAFF_USER,
			permissions: []
		});
		mocks.hasOrderChatPermission.mockResolvedValueOnce(false);

		const response = await GET(eventArgs('order-1', 'session-1'));

		expect(response.status).toBe(403);
		expect(mocks.tryAddConnection).not.toHaveBeenCalled();
	});

	it('starts the SSE stream when caps allow the connection', async () => {
		mocks.validateSessionForChatStream.mockResolvedValueOnce(STAFF_USER);
		const response = await GET(eventArgs('order-1', 'session-1'));

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');

		// Drive the stream so `start()` runs and reaches tryAddConnection.
		const reader = response.body!.getReader();
		const { value } = await reader.read();
		expect(new TextDecoder().decode(value)).toContain('"type":"connected"');
		expect(mocks.tryAddConnection).toHaveBeenCalledWith('order-1', expect.any(Object));
		await reader.cancel();
	});

	it('signals limit_exceeded when caps reject the connection', async () => {
		mocks.validateSessionForChatStream.mockResolvedValueOnce(STAFF_USER);
		mocks.tryAddConnection.mockResolvedValueOnce(false);

		const response = await GET(eventArgs('order-1', 'session-1'));
		const reader = response.body!.getReader();

		const { value, done } = await reader.read();
		expect(done).toBe(false);
		expect(new TextDecoder().decode(value)).toContain('limit_exceeded');
		const next = await reader.read();
		expect(next.done).toBe(true);
	});
});
