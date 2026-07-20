import type { RequestEvent, Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { validateSession, type AuthUser } from '../auth';

export interface Context {
	user: AuthUser | null;
	sessionId: string | null;
	internalApiKey: string | null;
	clientIp: string | null;
	isSecureRequest: boolean;
	requestId: string;
	cookies: Cookies;
}

export async function createContext(event: RequestEvent): Promise<Context> {
	const sessionId = event.cookies.get('session_id') || null;
	const internalApiKey = event.request.headers.get('x-internal-api-key');
	const isLocalhost =
		event.url.hostname === 'localhost' ||
		event.url.hostname === '127.0.0.1' ||
		event.url.hostname === '::1';
	const clientIp = event.getClientAddress();
	const isSecureRequest = event.url.protocol === 'https:' || (!dev && !isLocalhost);
	const requestId = event.locals.requestId || event.request.headers.get('x-request-id') || crypto.randomUUID();

	if (!sessionId) {
		return {
			user: null,
			sessionId: null,
			internalApiKey,
			clientIp,
			isSecureRequest,
			requestId,
			cookies: event.cookies
		};
	}

	const user = await validateSession(sessionId);
	return { user, sessionId, internalApiKey, clientIp, isSecureRequest, requestId, cookies: event.cookies };
}
