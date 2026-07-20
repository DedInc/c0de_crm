/**
 * R2 file storage operations: upload, delete, presign, list.
 */

import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, getR2Bucket } from './client';

const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'text/plain',
	'application/zip',
	'application/x-rar-compressed',
	'application/vnd.rar',
	'application/x-7z-compressed',
	'application/gzip',
	'application/x-tar'
];

export interface UploadResult {
	key: string;
	size: number;
	contentType: string;
}

/**
 * Upload a file to R2.
 * Returns the storage key (without `r2:` prefix — caller adds it).
 */
export async function uploadFile(
	buffer: Buffer | Uint8Array,
	key: string,
	contentType: string
): Promise<UploadResult> {
	if (buffer.length > MAX_FILE_SIZE) {
		throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
	}

	if (!ALLOWED_MIME_TYPES.includes(contentType)) {
		const allowed = '.pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .zip, .rar, .7z, .gz, .tar, .jpg, .png, .gif, .webp';
		throw new Error(`Unsupported file type: ${contentType}. Allowed: ${allowed}`);
	}

	const client = getR2Client();
	const bucket = getR2Bucket();

	await client.send(new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: buffer,
		ContentType: contentType,
		CacheControl: 'public, max-age=31536000, immutable'
	}));

	return { key, size: buffer.length, contentType };
}

/**
 * Generate a presigned GET URL for a file in R2.
 */
export async function getPresignedUrl(key: string): Promise<string> {
	const client = getR2Client();
	const bucket = getR2Bucket();

	return await getSignedUrl(
		client,
		new GetObjectCommand({ Bucket: bucket, Key: key }),
		{ expiresIn: PRESIGNED_URL_EXPIRY }
	);
}

/**
 * Delete a single file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
	const client = getR2Client();
	const bucket = getR2Bucket();

	await client.send(new DeleteObjectCommand({
		Bucket: bucket,
		Key: key
	}));
}

/**
 * Delete all files under a given prefix (e.g., `chat/{orderId}/`).
 */
export async function deleteFilesByPrefix(prefix: string): Promise<number> {
	const client = getR2Client();
	const bucket = getR2Bucket();

	let deleted = 0;
	let continuationToken: string | undefined;

	do {
		const listResult = await client.send(new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: prefix,
			ContinuationToken: continuationToken
		}));

		if (listResult.Contents) {
			for (const obj of listResult.Contents) {
				if (obj.Key) {
					await client.send(new DeleteObjectCommand({
						Bucket: bucket,
						Key: obj.Key
					}));
					deleted++;
				}
			}
		}

		continuationToken = listResult.NextContinuationToken;
	} while (continuationToken);

	return deleted;
}

/**
 * Generate a storage key for a chat image.
 */
export function chatImageKey(orderId: string, filename: string): string {
	const uuid = crypto.randomUUID();
	const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.jpg';
	return `chat/${orderId}/${uuid}${ext}`;
}

/**
 * Generate a storage key for a chat file (document, archive, etc.).
 */
export function chatFileKey(orderId: string, filename: string): string {
	const uuid = crypto.randomUUID();
	const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
	return `chat/${orderId}/${uuid}_${safeName}`;
}

/**
 * Check if a MIME type is an image type.
 */
export function isImageMime(mime: string): boolean {
	return mime.startsWith('image/');
}

export { isR2Configured } from './client';
export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
