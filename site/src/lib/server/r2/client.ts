/**
 * Cloudflare R2 client configuration.
 * R2 is S3-compatible — we use the AWS SDK with a custom endpoint.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
	if (_client) return _client;

	const accountId = env.R2_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

	if (!accountId || !accessKeyId || !secretAccessKey) {
		throw new Error('R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
	}

	_client = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

	return _client;
}

export function getR2Bucket(): string {
	const bucket = env.R2_BUCKET_NAME;
	if (!bucket) {
		throw new Error('R2_BUCKET_NAME not configured');
	}
	return bucket;
}

export function isR2Configured(): boolean {
	return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
}
