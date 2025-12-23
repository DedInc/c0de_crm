import { writable, derived, get } from 'svelte/store';
import en from './locales/en';
import ru from './locales/ru';

export type Locale = 'en' | 'ru';

export const locales: Record<Locale, Record<string, string>> = {
	en,
	ru
};

export const locale = writable<Locale>('en');

export function setLocale(newLocale: Locale) {
	locale.set(newLocale);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('locale', newLocale);
	}
}

export function initLocale() {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('locale') as Locale | null;
		if (saved && locales[saved]) {
			locale.set(saved);
		}
	}
}

export const t = derived(locale, ($locale) => {
	return (key: string, params?: Record<string, string | number>): string => {
		let text = locales[$locale][key] || locales['en'][key] || key;
		
		if (params) {
			Object.entries(params).forEach(([k, v]) => {
				text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
			});
		}
		
		return text;
	};
});

// Helper function for use outside of Svelte components
export function translate(key: string, params?: Record<string, string | number>): string {
	const $locale = get(locale);
	let text = locales[$locale][key] || locales['en'][key] || key;
	
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
		});
	}
	
	return text;
}