const CHAT_R2_PREFIX = 'chat/';

export function getOrderIdFromChatR2Key(key: string): string | null {
	if (!key.startsWith(CHAT_R2_PREFIX) || key.includes('..') || key.includes('\\')) {
		return null;
	}

	const parts = key.split('/');
	const [, orderId, filename] = parts;
	if (parts.length !== 3 || !orderId || !filename) {
		return null;
	}

	return orderId;
}
