/**
 * Helper functions for sending messages via bot webhook
 */

const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || 'http://localhost:8081';

export async function sendMessageToBot(
	telegramId: string,
	message: string,
	orderTitle?: string,
	orderId?: string,
	imageUrls?: string[]
): Promise<boolean> {
	try {
		if (!imageUrls || imageUrls.length === 0) {
			return sendSingleMessageToBot(telegramId, message, orderTitle, orderId);
		}

		for (let i = 0; i < imageUrls.length; i++) {
			const caption = i === 0 ? message : '';
			await sendSingleMessageToBot(
				telegramId,
				caption,
				i === 0 ? orderTitle : undefined,
				i === 0 ? orderId : undefined,
				imageUrls[i]
			);
		}

		return true;
	} catch {
		return false;
	}
}

async function sendSingleMessageToBot(
	telegramId: string,
	message: string,
	orderTitle?: string,
	orderId?: string,
	imageUrl?: string
): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/send-message`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				telegramId,
				message,
				orderTitle,
				orderId,
				imageUrls: imageUrl ? [imageUrl] : undefined
			})
		});

		return response.ok;
	} catch {
		return false;
	}
}

export async function notifyBot(type: string, data: Record<string, unknown>): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/notify`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, ...data })
		});

		return response.ok;
	} catch {
		return false;
	}
}

export async function notifyStaff(type: string, data: Record<string, unknown>): Promise<boolean> {
	try {
		const response = await fetch(`${BOT_WEBHOOK_URL}/notify-staff`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, ...data })
		});

		return response.ok;
	} catch {
		return false;
	}
}
