import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'theme';

function getInitialTheme(): Theme {
	if (!browser) return 'system';
	const stored = localStorage.getItem(THEME_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored;
	}
	return 'system';
}

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(getInitialTheme());

export function setTheme(newTheme: Theme): void {
	theme.set(newTheme);
	if (browser) {
		localStorage.setItem(THEME_KEY, newTheme);
		applyTheme(newTheme);
	}
}

export function applyTheme(currentTheme: Theme): void {
	if (!browser) return;
	
	const effectiveTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
	const root = document.documentElement;
	
	if (effectiveTheme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

export function initTheme(): void {
	if (!browser) return;
	
	const currentTheme = getInitialTheme();
	applyTheme(currentTheme);
	
	// Listen for system theme changes
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', () => {
		const current = get(theme);
		if (current === 'system') {
			applyTheme('system');
		}
	});
}

export function toggleTheme(): void {
	const current = get(theme);
	
	let next: Theme;
	if (current === 'light') {
		next = 'dark';
	} else if (current === 'dark') {
		next = 'system';
	} else {
		next = 'light';
	}
	setTheme(next);
}