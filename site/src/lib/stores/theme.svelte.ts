import { toStore } from 'svelte/store';
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

let current = $state<Theme>(getInitialTheme());

export const theme = toStore(
	() => current,
	(value: Theme) => {
		current = value;
	}
);

export function setTheme(newTheme: Theme): void {
	current = newTheme;
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

	const initialTheme = getInitialTheme();
	current = initialTheme;
	applyTheme(initialTheme);

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', () => {
		if (current === 'system') {
			applyTheme('system');
		}
	});
}

export function toggleTheme(): void {
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
