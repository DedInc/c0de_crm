/**
 * File upload endpoint for R2 storage.
 * Accepts multipart form data with `file` and `orderId` fields.
 * Supports both session auth (staff) and internal API key auth (bot).
 */

import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { validateSession, type AuthUser } from '$lib/server/auth';
import { canAccessOrderChatFiles, orderExists } from '$lib/server/files/access';
import { uploadFile, chatImageKey, chatFileKey, isImageMime, isR2Configured, MAX_FILE_SIZE } from '$lib/server/r2';
import { checkRateLimit } from '$lib/server/rate-limit';
import { validateInternalApiKey } from '$lib/server/internal-auth';

const DEFAULT_UPLOAD_MAX_PER_USER = 60;
const DEFAULT_UPLOAD_WINDOW_SECONDS = 3600;
const DEFAULT_UPLOAD_MAX_PER_ORDER_PER_DAY = 100;

function getPositiveIntEnv(name: string, fallback: number): number {
	const parsed = parseInt(env[name] || '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	});
}

async function enforceUploadRateLimit(bucket: string, maxAttempts: number, windowSeconds: number): Promise<Response | null> {
	const result = await checkRateLimit(bucket, maxAttempts, windowSeconds, {
		failClosedEnv: 'UPLOAD_RATE_LIMIT_FAIL_CLOSED'
	});
	if (result.allowed) return null;
	return jsonError('Too many uploads. Try again later.', 429, {
		'Retry-After': result.retryAfterSeconds.toString()
	});
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!isR2Configured()) {
		return jsonError('File storage not configured', 503);
	}

	// Auth: session cookie OR internal API key
	const internalKey = request.headers.get('x-internal-api-key');
	let internalAuthenticated = false;
	let user: AuthUser | null = null;

	if (validateInternalApiKey(internalKey)) {
		internalAuthenticated = true;
	} else {
		const sessionId = cookies.get('session_id');
		if (sessionId) {
			user = await validateSession(sessionId);
		}
	}

	if (!internalAuthenticated && !user) {
		return jsonError('Unauthorized', 401);
	}

	const uploadWindowSeconds = getPositiveIntEnv('UPLOAD_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_UPLOAD_WINDOW_SECONDS);
	const uploadMaxPerUser = getPositiveIntEnv('UPLOAD_RATE_LIMIT_MAX_PER_USER', DEFAULT_UPLOAD_MAX_PER_USER);
	const actorBucket = user ? `upload:user:${user.id}` : 'upload:internal';
	const actorLimit = await enforceUploadRateLimit(actorBucket, uploadMaxPerUser, uploadWindowSeconds);
	if (actorLimit) return actorLimit;

	const contentType = request.headers.get('content-type') || '';
	if (!contentType.includes('multipart/form-data')) {
		return jsonError('Expected multipart/form-data', 400);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch (err) {
		const detail = err instanceof Error ? err.message : '';
		if (detail.includes('size') || detail.includes('limit') || detail.includes('BODY_SIZE_LIMIT')) {
			return jsonError('File too large for server. Max upload size is 10MB.', 413);
		}
		return jsonError('Invalid form data. The file may be corrupted or the upload was interrupted.', 400);
	}

	const file = formData.get('file');
	const orderId = formData.get('orderId');

	if (!file || !(file instanceof File)) {
		return jsonError('Missing file field', 400);
	}

	if (!orderId || typeof orderId !== 'string') {
		return jsonError('Missing orderId field', 400);
	}

	if (!(await orderExists(orderId))) {
		return jsonError('Order not found', 404);
	}

	const orderLimit = await enforceUploadRateLimit(
		`upload:order:${orderId}`,
		getPositiveIntEnv('UPLOAD_MAX_PER_ORDER_PER_DAY', DEFAULT_UPLOAD_MAX_PER_ORDER_PER_DAY),
		86400
	);
	if (orderLimit) return orderLimit;

	if (user && !(await canAccessOrderChatFiles(user, orderId))) {
		return jsonError('Forbidden', 403);
	}

	if (file.size > MAX_FILE_SIZE) {
		return jsonError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, 413);
	}

	if (file.size === 0) {
		return jsonError('Empty file', 400);
	}

	const fileMime = file.type || 'application/octet-stream';
	const filename = file.name || 'file';
	const key = isImageMime(fileMime)
		? chatImageKey(orderId, filename)
		: chatFileKey(orderId, filename);

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const result = await uploadFile(buffer, key, fileMime);

		return new Response(JSON.stringify({
			key: `r2:${result.key}`,
			size: result.size,
			contentType: result.contentType
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Upload failed';
		const status = message.includes('too large') || message.includes('Unsupported') ? 400 : 500;
		return jsonError(message, status);
	}
};
