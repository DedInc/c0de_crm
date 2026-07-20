import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import type { AuthUser } from '$lib/server/auth';

const mocks = vi.hoisted(() => ({
	validateSession: vi.fn(),
	orderExists: vi.fn(),
	canAccessOrderChatFiles: vi.fn(),
	isR2Configured: vi.fn(),
	getPresignedUrl: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		BOT_TOKEN: 'bot-token'
	}
}));

vi.mock('$lib/server/auth', () => ({
	validateSession: mocks.validateSession
}));

vi.mock('$lib/server/files/access', async () => {
	const pathModule = await import('$lib/server/files/path');

	return {
		getOrderIdFromChatR2Key: pathModule.getOrderIdFromChatR2Key,
		orderExists: mocks.orderExists,
		canAccessOrderChatFiles: mocks.canAccessOrderChatFiles
	};
});

vi.mock('$lib/server/r2', () => ({
	isR2Configured: mocks.isR2Configured,
	getPresignedUrl: mocks.getPresignedUrl
}));

const STAFF_USER: AuthUser = {
	id: 'staff-1',
	username: 'staff',
	telegramId: null,
	permissions: [],
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

function proxyRequest(path: string, orderId?: string): Request {
	const url = new URL('http://localhost/api/chat/telegram-image');
	url.searchParams.set('path', path);
	if (orderId) {
		url.searchParams.set('orderId', orderId);
	}

	return new Request(url);
}

describe('GET /api/chat/telegram-image security', () => {
	beforeEach(() => {
		mocks.validateSession.mockReset();
		mocks.orderExists.mockReset();
		mocks.canAccessOrderChatFiles.mockReset();
		mocks.isR2Configured.mockReset();
		mocks.getPresignedUrl.mockReset();

		mocks.validateSession.mockResolvedValue(STAFF_USER);
		mocks.orderExists.mockResolvedValue(true);
		mocks.canAccessOrderChatFiles.mockResolvedValue(false);
		mocks.isR2Configured.mockReturnValue(true);
		mocks.getPresignedUrl.mockResolvedValue('https://r2.example/chat/order-1/file.png');
	});

	it('rejects requests without a session', async () => {
		const response = await GET({
			url: new URL(proxyRequest('r2:chat/order-1/file.png').url),
			cookies: cookiesWith()
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(401);
		expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
	});

	it('rejects R2 downloads without order access', async () => {
		const response = await GET({
			url: new URL(proxyRequest('r2:chat/order-1/file.png', 'order-1').url),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(403);
		expect(mocks.canAccessOrderChatFiles).toHaveBeenCalledWith(STAFF_USER, 'order-1');
		expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
	});

	it('redirects R2 downloads for users with order access', async () => {
		mocks.canAccessOrderChatFiles.mockResolvedValue(true);

		const response = await GET({
			url: new URL(proxyRequest('r2:chat/order-1/file.png', 'order-1').url),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://r2.example/chat/order-1/file.png');
	});

	it('rejects R2 keys when requested order scope does not match the embedded order', async () => {
		const response = await GET({
			url: new URL(proxyRequest('r2:chat/order-2/file.png', 'order-1').url),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		expect(mocks.canAccessOrderChatFiles).not.toHaveBeenCalled();
		expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
	});

	it('rejects Telegram file requests without an explicit order scope', async () => {
		const response = await GET({
			url: new URL(proxyRequest('tg-file:photos/file_1.jpg').url),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		expect(mocks.getPresignedUrl).not.toHaveBeenCalled();
	});
});
