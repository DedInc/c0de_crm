import { toStore } from 'svelte/store';
import { SvelteMap } from 'svelte/reactivity';
import { trpc } from '$lib/trpc/client';

export interface CurrencyInfo {
	code: string;
	symbol: string;
	isDefault: boolean;
	id: string;
}

let currencyList = $state<CurrencyInfo[]>([]);
let loaded = $state(false);
let display = $state<string>('USD');

export const currencies = toStore(
	() => currencyList,
	(value: CurrencyInfo[]) => {
		currencyList = value;
	}
);

export const currenciesLoaded = toStore(
	() => loaded,
	(value: boolean) => {
		loaded = value;
	}
);

export const displayCurrency = toStore(
	() => display,
	(value: string) => {
		display = value;
	}
);

let fetchPromise: Promise<void> | null = null;

export async function loadCurrencies(): Promise<CurrencyInfo[]> {
	if (loaded && currencyList.length > 0) {
		return currencyList;
	}
	if (!fetchPromise) {
		fetchPromise = (async () => {
			try {
				const list = await trpc.currency.list.query();
				currencyList = list;
				loaded = true;
			} catch {
				// Fallback if DB is empty
				currencyList = [{ code: 'USD', symbol: '$', isDefault: true, id: '' }];
				loaded = true;
			} finally {
				fetchPromise = null;
			}
		})();
	}
	await fetchPromise;
	return currencyList;
}

export function initDisplayCurrency(): void {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('displayCurrency');
		if (saved) {
			display = saved;
		}
	}
	loadCurrencies();
}

export function setDisplayCurrency(currency: string): void {
	display = currency;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('displayCurrency', currency);
	}
}

const rateCache = new SvelteMap<string, { rate: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function convertCurrency(amount: number, from: string, to: string): Promise<number> {
	if (from === to) return amount;

	const cacheKey = `${from}_${to}`;
	const cached = rateCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return +(amount * cached.rate).toFixed(6);
	}

	try {
		const result = await trpc.currency.convert.query({ amount, from, to });
		rateCache.set(cacheKey, { rate: result.rate, timestamp: Date.now() });
		return result.converted;
	} catch {
		return amount;
	}
}

export function getCurrencySymbol(code: string): string {
	const found = currencyList.find((c) => c.code === code);
	if (found) return found.symbol;
	return code;
}

export function formatPrice(amount: number, currency: string): string {
	const symbol = getCurrencySymbol(currency);
	const cryptoCodes = ['BTC', 'ETH'];
	if (cryptoCodes.includes(currency)) {
		return `${amount} ${symbol}`;
	}
	return `${symbol}${amount}`;
}
