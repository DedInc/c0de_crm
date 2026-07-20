import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {}
}));

const { chatImageKey, chatFileKey, isImageMime, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = await import('./index');

describe('chatImageKey', () => {
	it('produces an order-scoped key with a uuid prefix and the original extension', () => {
		const key = chatImageKey('order-1', 'photo.JPG');
		expect(key).toMatch(/^chat\/order-1\/[0-9a-f-]+\.JPG$/);
	});

	it('falls back to .jpg when the filename has no extension', () => {
		const key = chatImageKey('order-1', 'image');
		expect(key.endsWith('.jpg')).toBe(true);
	});
});

describe('chatFileKey', () => {
	it('replaces unsafe characters and truncates very long names', () => {
		const original = 'Лётный отчёт *secret*.pdf'.repeat(8);
		const key = chatFileKey('order-1', original);
		expect(key.startsWith('chat/order-1/')).toBe(true);
		expect(key).not.toContain(' ');
		expect(key).not.toContain('*');
		const safeName = key.split('_').slice(1).join('_');
		expect(safeName.length).toBeLessThanOrEqual(64);
	});
});

describe('isImageMime', () => {
	it('detects image MIME types', () => {
		expect(isImageMime('image/png')).toBe(true);
		expect(isImageMime('image/svg+xml')).toBe(true);
	});

	it('rejects non-image MIME types', () => {
		expect(isImageMime('application/pdf')).toBe(false);
		expect(isImageMime('text/plain')).toBe(false);
		expect(isImageMime('')).toBe(false);
	});
});

describe('module exports', () => {
	it('exposes a 10MB file size cap and the allow-list', () => {
		expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
		expect(ALLOWED_MIME_TYPES).toContain('image/png');
		expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
		expect(ALLOWED_MIME_TYPES).not.toContain('text/html');
	});
});
