/**
 * Helper functions for sending messages via bot webhook
 */

import { env } from '$env/dynamic/private';
import { getPresignedUrl, isR2Configured } from '../../../r2';
import { getOrderIdFromChatR2Key } from '../../../files/path';

function getBotWebhookUrl(): string {
	return env.BOT_WEBHOOK_URL || 'http://localhost:8081';
}

function getInternalHeaders(): Record<string, string> {
	const requestId = crypto.randomUUID();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-request-id': requestId,
		'x-idempotency-key': requestId
	};
	if (env.INTERNAL_API_KEY) {
		headers['x-internal-api-key'] = env.INTERNAL_API_KEY;
	}
	return headers;
}

/**
 * Resolve r2: image references to presigned URLs for the bot.
 * tg-file: and other URLs are passed through unchanged.
 */
async function resolveImageUrls(urls: string[], orderId?: string): Promise<string[]> {
	if (!isR2Configured()) return urls;

	return Promise.all(urls.map(async (url) => {
		if (url.startsWith('r2:')) {
			if (!orderId || getOrderIdFromChatR2Key(url.slice(3)) !== orderId) {
				return url;
			}
			try {
				return await getPresignedUrl(url.slice(3));
			} catch {
				return url;
			}
		}
		return url;
	}));
}

async function fetchWithRetry(
	url: string,
	options: RequestInit,
	maxRetries = 3
): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const response = await fetch(url, options);
			if (response.ok || response.status < 500) {
				return response;
			}
			lastError = new Error(`HTTP ${response.status}`);
		} catch (err) {
			lastError = err;
		}
		if (attempt < maxRetries - 1) {
			const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw lastError;
}

export async function sendMessageToBot(
	telegramId: string,
	message: string,
	orderTitle?: string,
	orderId?: string,
	imageUrls?: string[],
	fileUrls?: { url: string; name: string; type: string }[]
): Promise<boolean> {
	try {
		// Send images if provided
		if (imageUrls && imageUrls.length > 0) {
			const resolved = await resolveImageUrls(imageUrls, orderId);

			for (let i = 0; i < resolved.length; i++) {
				const caption = i === 0 ? message : '';
				await sendSingleMessageToBot(
					telegramId,
					caption,
					i === 0 ? orderTitle : undefined,
					i === 0 ? orderId : undefined,
					resolved[i]
				);
			}
		}

		// Send files/documents if provided
		if (fileUrls && fileUrls.length > 0) {
			const resolvedFiles = await resolveFileUrls(fileUrls, orderId);
			const caption = (!imageUrls || imageUrls.length === 0) ? message : '';
			await sendFilesToBot(telegramId, resolvedFiles, caption, orderTitle, orderId);
		}

		// Send text-only message if no media
		if ((!imageUrls || imageUrls.length === 0) && (!fileUrls || fileUrls.length === 0)) {
			return sendSingleMessageToBot(telegramId, message, orderTitle, orderId);
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
		const response = await fetchWithRetry(`${getBotWebhookUrl()}/send-message`, {
			method: 'POST',
			headers: getInternalHeaders(),
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

/**
 * Resolve r2: file references to presigned URLs for the bot.
 */
async function resolveFileUrls(
	files: { url: string; name: string; type: string }[],
	orderId?: string
): Promise<{ url: string; name: string; type: string }[]> {
	if (!isR2Configured()) return files;

	return Promise.all(files.map(async (file) => {
		if (file.url.startsWith('r2:')) {
			if (!orderId || getOrderIdFromChatR2Key(file.url.slice(3)) !== orderId) {
				return file;
			}
			try {
				const resolved = await getPresignedUrl(file.url.slice(3));
				return { ...file, url: resolved };
			} catch {
				return file;
			}
		}
		return file;
	}));
}

async function sendFilesToBot(
	telegramId: string,
	files: { url: string; name: string; type: string }[],
	message: string,
	orderTitle?: string,
	orderId?: string
): Promise<boolean> {
	try {
		const response = await fetchWithRetry(`${getBotWebhookUrl()}/send-message`, {
			method: 'POST',
			headers: getInternalHeaders(),
			body: JSON.stringify({
				telegramId,
				message,
				orderTitle,
				orderId,
				fileUrls: files
			})
		});

		return response.ok;
	} catch {
		return false;
	}
}

export async function notifyBot(type: string, data: Record<string, unknown>): Promise<boolean> {
	try {
		const response = await fetchWithRetry(`${getBotWebhookUrl()}/notify`, {
			method: 'POST',
			headers: getInternalHeaders(),
			body: JSON.stringify({ type, ...data })
		});

		return response.ok;
	} catch {
		return false;
	}
}

export async function notifyStaff(type: string, data: Record<string, unknown>): Promise<boolean> {
	try {
		const response = await fetchWithRetry(`${getBotWebhookUrl()}/notify-staff`, {
			method: 'POST',
			headers: getInternalHeaders(),
			body: JSON.stringify({ type, ...data })
		});

		return response.ok;
	} catch {
		return false;
	}
}
