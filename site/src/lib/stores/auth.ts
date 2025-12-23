import { writable, derived } from 'svelte/store';
import { trpc } from '$lib/trpc/client';
import { browser } from '$app/environment';

export interface AuthUser {
	id: string;
	username: string;
	telegramId: string | null;
	permissions: string[];
	roles: string[];
}

export const user = writable<AuthUser | null>(null);
export const isAuthenticated = derived(user, ($user) => $user !== null);
export const isLoading = writable(true);

export function hasPermission(permission: string): boolean {
	let currentUser: AuthUser | null = null;
	const unsubscribe = user.subscribe(u => currentUser = u);
	unsubscribe();
	if (!currentUser) return false;
	const u = currentUser as AuthUser;
	return u.permissions.includes(permission) || u.roles.includes('Administrator');
}

export function hasAnyPermission(permissions: string[]): boolean {
	let currentUser: AuthUser | null = null;
	const unsubscribe = user.subscribe(u => currentUser = u);
	unsubscribe();
	if (!currentUser) return false;
	const u = currentUser as AuthUser;
	if (u.roles.includes('Administrator')) return true;
	return permissions.some(p => u.permissions.includes(p));
}

export function isAdmin(): boolean {
	let currentUser: AuthUser | null = null;
	const unsubscribe = user.subscribe(u => currentUser = u);
	unsubscribe();
	if (!currentUser) return false;
	const u = currentUser as AuthUser;
	return u.roles.includes('Administrator');
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; errorKey?: string }> {
	if (!browser) {
		return { success: false, error: 'Cannot login during SSR' };
	}
	try {
		const result = await trpc.auth.login.mutate({ username, password });
		
		// Set cookie
		document.cookie = `session_id=${result.sessionId}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
		
		user.set(result.user);
		return { success: true };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Login failed';
		// Check for known error messages and return translation keys
		if (message === 'Invalid credentials') {
			return { success: false, errorKey: 'auth.invalidCredentials' };
		}
		return { success: false, error: message };
	}
}

export async function logout(): Promise<void> {
	if (!browser) {
		return;
	}
	try {
		await trpc.auth.logout.mutate();
	} catch {
		// Ignore errors
	}
	
	document.cookie = 'session_id=; path=/; max-age=0';
	
	user.set(null);
}

export async function checkAuth(): Promise<void> {
	if (!browser) {
		isLoading.set(false);
		return;
	}
	isLoading.set(true);
	try {
		const currentUser = await trpc.auth.me.query();
		user.set(currentUser);
	} catch {
		user.set(null);
	} finally {
		isLoading.set(false);
	}
}