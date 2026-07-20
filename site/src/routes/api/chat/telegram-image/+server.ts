import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { validateSession } from '$lib/server/auth';
import {
	canAccessOrderChatFiles,
	getOrderIdFromChatR2Key,
	orderExists
} from '$lib/server/files/access';
import { getPresignedUrl, isR2Configured } from '$lib/server/r2';

const EXT_TO_MIME: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.tiff': 'image/tiff',
	'.tif': 'image/tiff',
	'.ico': 'image/x-icon',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.txt': 'text/plain',
	'.zip': 'application/zip',
	'.rar': 'application/vnd.rar',
	'.7z': 'application/x-7z-compressed',
	'.gz': 'application/gzip',
	'.tar': 'application/x-tar'
};

const MAGIC_BYTES: [Uint8Array, string][] = [
	[new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'],
	[new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/png'],
	[new Uint8Array([0x47, 0x49, 0x46, 0x38]), 'image/gif'],
	[new Uint8Array([0x52, 0x49, 0x46, 0x46]), 'image/webp'],
	[new Uint8Array([0x42, 0x4d]), 'image/bmp']
];

function detectMimeFromBytes(buffer: ArrayBuffer): string | null {
	const bytes = new Uint8Array(buffer.slice(0, 12));
	for (const [signature, mime] of MAGIC_BYTES) {
		if (signature.every((b, i) => bytes[i] === b)) {
			if (mime === 'image/webp') {
				return bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
					? 'image/webp'
					: null;
			}
			return mime;
		}
	}
	return null;
}

function getMimeFromPath(filePath: string): string | null {
	const dotIdx = filePath.lastIndexOf('.');
	if (dotIdx === -1) return null;
	const ext = filePath.slice(dotIdx).toLowerCase();
	return EXT_TO_MIME[ext] || null;
}

function getExtensionForMime(mime: string): string {
	for (const [ext, m] of Object.entries(EXT_TO_MIME)) {
		if (m === mime) return ext;
	}
	return '';
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const filePath = url.searchParams.get('path');
	const requestedOrderId = url.searchParams.get('orderId');

	if (!filePath) {
		return new Response('Missing path', { status: 400 });
	}

	const sessionId = cookies.get('session_id');
	if (!sessionId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await validateSession(sessionId);
	if (!user) {
		return new Response('Unauthorized', { status: 401 });
	}

	// Handle R2 files: redirect to presigned URL
	if (filePath.startsWith('r2:')) {
		if (!isR2Configured()) {
			return new Response('File storage not configured', { status: 503 });
		}
		const r2Key = filePath.slice(3);
		if (!r2Key || r2Key.includes('..')) {
			return new Response('Invalid path', { status: 400 });
		}
		const orderId = getOrderIdFromChatR2Key(r2Key);
		if (!orderId) {
			return new Response('Invalid path', { status: 400 });
		}
		if (requestedOrderId && requestedOrderId !== orderId) {
			return new Response('Invalid order scope', { status: 400 });
		}
		if (!(await orderExists(orderId))) {
			return new Response('File not found', { status: 404 });
		}
		if (!(await canAccessOrderChatFiles(user, orderId))) {
			return new Response('Forbidden', { status: 403 });
		}
		try {
			const presignedUrl = await getPresignedUrl(r2Key);
			return new Response(null, {
				status: 302,
				headers: { 'Location': presignedUrl, 'Cache-Control': 'private, max-age=3500' }
			});
		} catch {
			return new Response('File not found', { status: 404 });
		}
	}

	// Strip tg-file: prefix if present
	let telegramPath = filePath;
	if (filePath.startsWith('tg-file:')) {
		telegramPath = filePath.slice('tg-file:'.length);
	}

	if (!requestedOrderId) {
		return new Response('Missing orderId', { status: 400 });
	}

	if (!(await orderExists(requestedOrderId))) {
		return new Response('File not found', { status: 404 });
	}

	if (!(await canAccessOrderChatFiles(user, requestedOrderId))) {
		return new Response('Forbidden', { status: 403 });
	}

	// Handle Telegram files
	if (telegramPath.includes('..') || telegramPath.startsWith('/')) {
		return new Response('Invalid path', { status: 400 });
	}

	const botToken = env.BOT_TOKEN;
	if (!botToken) {
		return new Response('Server configuration error', { status: 500 });
	}

	try {
		const telegramUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;
		const response = await fetch(telegramUrl);

		if (!response.ok) {
			return new Response('File not found', { status: 404 });
		}

		const body = await response.arrayBuffer();

		let contentType = getMimeFromPath(telegramPath);
		if (!contentType) {
			contentType = detectMimeFromBytes(body);
		}
		if (!contentType) {
			const upstream = response.headers.get('content-type');
			contentType = upstream && upstream !== 'application/octet-stream' ? upstream : 'image/jpeg';
		}

		const ext = getExtensionForMime(contentType) || '.jpg';
		const basename = telegramPath.split('/').pop() || `file${ext}`;
		const filename = basename.includes('.') ? basename : `${basename}${ext}`;

		return new Response(body, {
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Cache-Control': 'public, max-age=86400, immutable',
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
			}
		});
	} catch {
		return new Response('Failed to fetch image', { status: 502 });
	}
};
