import { describe, expect, it } from 'vitest';
import { getOrderIdFromChatR2Key } from './path';

describe('getOrderIdFromChatR2Key', () => {
	it('extracts the order id from a valid chat R2 key', () => {
		expect(getOrderIdFromChatR2Key('chat/order-123/file.png')).toBe('order-123');
	});

	it('rejects keys outside the chat namespace', () => {
		expect(getOrderIdFromChatR2Key('avatars/order-123/file.png')).toBeNull();
	});

	it('rejects traversal attempts', () => {
		expect(getOrderIdFromChatR2Key('chat/order-123/../secret.png')).toBeNull();
		expect(getOrderIdFromChatR2Key('chat/order-123\\secret.png')).toBeNull();
	});

	it('rejects incomplete keys', () => {
		expect(getOrderIdFromChatR2Key('chat/order-123')).toBeNull();
		expect(getOrderIdFromChatR2Key('chat//file.png')).toBeNull();
	});

	it('rejects keys with nested segments after the filename', () => {
		expect(getOrderIdFromChatR2Key('chat/order-123/folder/file.png')).toBeNull();
	});
});
