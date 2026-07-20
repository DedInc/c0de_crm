import { toStore } from 'svelte/store';
import { trpc } from '$lib/trpc/client';
import { browser } from '$app/environment';

export interface AuthUser {
	id: string;
	username: string;
	telegramId: string | null;
	permissions: string[];
	roles: string[];
}

let currentUser = $state<AuthUser | null>(null);
let loading = $state(true);

export const user = toStore(
	() => currentUser,
	(value: AuthUser | null) => {
		currentUser = value;
	}
);

export const isAuthenticated = toStore(() => currentUser !== null);

export const isLoading = toStore(
	() => loading,
	(value: boolean) => {
		loading = value;
	}
);

export function hasPermission(permission: string): boolean {
	if (!currentUser) return false;
	return currentUser.permissions.includes(permission) || currentUser.roles.includes('Administrator');
}

export function hasAnyPermission(permissions: string[]): boolean {
	if (!currentUser) return false;
	if (currentUser.roles.includes('Administrator')) return true;
	return permissions.some((p) => currentUser!.permissions.includes(p));
}

export function isAdmin(): boolean {
	if (!currentUser) return false;
	return currentUser.roles.includes('Administrator');
}

export async function login(
	username: string,
	password: string
): Promise<{ success: boolean; error?: string; errorKey?: string }> {
	if (!browser) {
		return { success: false, error: 'Cannot login during SSR' };
	}
	try {
		const result = await trpc.auth.login.mutate({ username, password });
		currentUser = result.user;
		return { success: true };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Login failed';
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

	currentUser = null;
}

export async function checkAuth(): Promise<void> {
	if (!browser) {
		loading = false;
		return;
	}
	loading = true;
	try {
		const fetched = await trpc.auth.me.query();
		currentUser = fetched;
	} catch {
		currentUser = null;
	} finally {
		loading = false;
	}
}
