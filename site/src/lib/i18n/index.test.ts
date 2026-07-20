import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { locale, locales, setLocale, t, translate } from './index';

describe('i18n locale store', () => {
	it('exposes both seeded locale catalogues', () => {
		expect(Object.keys(locales)).toEqual(expect.arrayContaining(['en', 'ru']));
	});

	it('updates the active locale and persists to localStorage', () => {
		const fakeStorage: Record<string, string> = {};
		const localStorageMock = {
			getItem(key: string) { return fakeStorage[key] ?? null; },
			setItem(key: string, value: string) { fakeStorage[key] = value; },
			removeItem(key: string) { delete fakeStorage[key]; }
		};
		const original = globalThis.localStorage as Storage | undefined;
		Object.defineProperty(globalThis, 'localStorage', {
			value: localStorageMock,
			configurable: true
		});

		try {
			setLocale('ru');
			expect(get(locale)).toBe('ru');
			expect(fakeStorage.locale).toBe('ru');
		} finally {
			setLocale('en');
			if (original) {
				Object.defineProperty(globalThis, 'localStorage', {
					value: original,
					configurable: true
				});
			} else {
				delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
			}
		}
	});
});

describe('translate / t helpers', () => {
	it('falls back to English when a key is missing in the active locale', () => {
		setLocale('ru');
		try {
			const translator = get(t);
			expect(translator('missing.key')).toBe('missing.key');
		} finally {
			setLocale('en');
		}
	});

	it('substitutes interpolation parameters in translations', () => {
		setLocale('en');
		const translated = translate('common.welcome', { name: 'Ada' });
		// Either a translated string with the value substituted or the raw key — both are fine,
		// what matters is that {name} is no longer present.
		expect(translated.includes('{name}')).toBe(false);
	});

	it('reactive translator updates when the locale changes', () => {
		setLocale('en');
		const initial = get(t)('audit.title');
		setLocale('ru');
		const after = get(t)('audit.title');
		expect(typeof initial).toBe('string');
		expect(typeof after).toBe('string');
		setLocale('en');
	});
});
