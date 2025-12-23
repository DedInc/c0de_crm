import type { RequestEvent } from '@sveltejs/kit';
import { validateSession, type AuthUser } from '../auth';

export interface Context {
	user: AuthUser | null;
	sessionId: string | null;
}

export async function createContext(event: RequestEvent): Promise<Context> {
	const sessionId = event.cookies.get('session_id') || null;
	
	if (!sessionId) {
		return { user: null, sessionId: null };
	}

	const user = await validateSession(sessionId);
	return { user, sessionId };
}