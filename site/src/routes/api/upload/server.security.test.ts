import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import type { AuthUser } from '$lib/server/auth';

const mocks = vi.hoisted(() => ({
	validateSession: vi.fn(),
	orderExists: vi.fn(),
	canAccessOrderChatFiles: vi.fn(),
	isR2Configured: vi.fn(),
	uploadFile: vi.fn(),
	chatImageKey: vi.fn(),
	chatFileKey: vi.fn(),
	isImageMime: vi.fn(),
	checkRateLimit: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		INTERNAL_API_KEY: 'internal-secret'
	}
}));

vi.mock('$lib/server/auth', () => ({
	validateSession: mocks.validateSession
}));

vi.mock('$lib/server/files/access', () => ({
	orderExists: mocks.orderExists,
	canAccessOrderChatFiles: mocks.canAccessOrderChatFiles
}));

vi.mock('$lib/server/r2', () => ({
	MAX_FILE_SIZE: 10 * 1024 * 1024,
	isR2Configured: mocks.isR2Configured,
	uploadFile: mocks.uploadFile,
	chatImageKey: mocks.chatImageKey,
	chatFileKey: mocks.chatFileKey,
	isImageMime: mocks.isImageMime
}));

vi.mock('$lib/server/rate-limit', () => ({
	checkRateLimit: mocks.checkRateLimit
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

function uploadRequest(orderId = 'order-1', headers: Record<string, string> = {}): Request {
	const form = new FormData();
	form.set('file', new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'proof.png', {
		type: 'image/png'
	}));
	form.set('orderId', orderId);

	return new Request('http://localhost/api/upload', {
		method: 'POST',
		body: form,
		headers
	});
}

describe('POST /api/upload security', () => {
	beforeEach(() => {
		mocks.validateSession.mockReset();
		mocks.orderExists.mockReset();
		mocks.canAccessOrderChatFiles.mockReset();
		mocks.isR2Configured.mockReset();
		mocks.uploadFile.mockReset();
		mocks.chatImageKey.mockReset();
		mocks.chatFileKey.mockReset();
		mocks.isImageMime.mockReset();
		mocks.checkRateLimit.mockReset();

		mocks.isR2Configured.mockReturnValue(true);
		mocks.orderExists.mockResolvedValue(true);
		mocks.canAccessOrderChatFiles.mockResolvedValue(false);
		mocks.checkRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 59,
			retryAfterSeconds: 0
		});
		mocks.isImageMime.mockImplementation((mime: string) => mime.startsWith('image/'));
		mocks.chatImageKey.mockImplementation((orderId: string, filename: string) => `chat/${orderId}/image-${filename}`);
		mocks.chatFileKey.mockImplementation((orderId: string, filename: string) => `chat/${orderId}/file-${filename}`);
		mocks.uploadFile.mockImplementation((buffer: Uint8Array, key: string, contentType: string) => ({
			key,
			size: buffer.length,
			contentType
		}));
	});

	it('rejects unauthenticated uploads', async () => {
		const response = await POST({
			request: uploadRequest(),
			cookies: cookiesWith()
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(401);
		expect(mocks.uploadFile).not.toHaveBeenCalled();
	});

	it('rejects staff uploads without order chat access', async () => {
		mocks.validateSession.mockResolvedValue(STAFF_USER);

		const response = await POST({
			request: uploadRequest(),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(403);
		expect(mocks.canAccessOrderChatFiles).toHaveBeenCalledWith(STAFF_USER, 'order-1');
		expect(mocks.uploadFile).not.toHaveBeenCalled();
	});

	it('rate limits authenticated upload attempts', async () => {
		mocks.validateSession.mockResolvedValue(STAFF_USER);
		mocks.checkRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			retryAfterSeconds: 30
		});

		const response = await POST({
			request: uploadRequest(),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('30');
		expect(mocks.uploadFile).not.toHaveBeenCalled();
	});

	it('allows staff uploads with order chat access', async () => {
		mocks.validateSession.mockResolvedValue(STAFF_USER);
		mocks.canAccessOrderChatFiles.mockResolvedValue(true);

		const response = await POST({
			request: uploadRequest(),
			cookies: cookiesWith('session-1')
		} as Parameters<typeof POST>[0]);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			key: 'r2:chat/order-1/image-proof.png',
			size: 4,
			contentType: 'image/png'
		});
	});

	it('allows internal bot uploads to existing orders', async () => {
		const response = await POST({
			request: uploadRequest('order-1', { 'x-internal-api-key': 'internal-secret' }),
			cookies: cookiesWith()
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(mocks.canAccessOrderChatFiles).not.toHaveBeenCalled();
	});

	it('rejects internal bot uploads to missing orders', async () => {
		mocks.orderExists.mockResolvedValue(false);

		const response = await POST({
			request: uploadRequest('missing-order', { 'x-internal-api-key': 'internal-secret' }),
			cookies: cookiesWith()
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(404);
		expect(mocks.uploadFile).not.toHaveBeenCalled();
	});
});
