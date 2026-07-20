import { timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

export function isInternalApiKeyConfigured(): boolean {
	return !!env.INTERNAL_API_KEY;
}

export function validateInternalApiKey(key: string | null | undefined): boolean {
	const expected = env.INTERNAL_API_KEY;
	if (!expected || !key) return false;

	try {
		const keyBuf = Buffer.from(key);
		const expectedBuf = Buffer.from(expected);
		return keyBuf.length === expectedBuf.length && timingSafeEqual(keyBuf, expectedBuf);
	} catch {
		return false;
	}
}
