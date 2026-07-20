import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { protectedProcedure, adminProcedure, t } from '../trpc';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USD_CODE = 'USD';
const RUB_CODE = 'RUB';
const USD_RUB_RATE_URL = 'https://api.frankfurter.dev/v2/rate/USD/RUB';

async function fetchCryptoCompareRate(from: string, to: string): Promise<number> {
	const res = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${from}&tsyms=${to}`);
	if (!res.ok) throw new Error(`CryptoCompare returned ${res.status}`);

	const data = (await res.json()) as Record<string, unknown>;
	const rate = data[to];
	if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid CryptoCompare rate response');

	return rate;
}

async function fetchUsdRubRate(): Promise<number> {
	const cacheKey = `${USD_CODE}_${RUB_CODE}`;
	const cached = rateCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.rate;
	}

	const res = await fetch(USD_RUB_RATE_URL);
	if (!res.ok) throw new Error(`Frankfurter returned ${res.status}`);

	const data = (await res.json()) as { rate?: unknown };
	const rate = data.rate;
	if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid Frankfurter RUB rate response');

	rateCache.set(cacheKey, { rate, timestamp: Date.now() });
	return rate;
}

async function fetchRubAwareRate(from: string, to: string): Promise<number> {
	// RUB rates are hard-coded through Frankfurter because sanctions against Russia
	// leave CryptoCompare and similar services without current ruble market data.
	const usdRubRate = await fetchUsdRubRate();

	if (from === USD_CODE && to === RUB_CODE) return usdRubRate;
	if (from === RUB_CODE && to === USD_CODE) return 1 / usdRubRate;
	if (to === RUB_CODE) return (await fetchCryptoCompareRate(from, USD_CODE)) * usdRubRate;
	if (from === RUB_CODE) return (1 / usdRubRate) * (await fetchCryptoCompareRate(USD_CODE, to));

	return fetchCryptoCompareRate(from, to);
}

async function fetchRate(from: string, to: string): Promise<number> {
	from = from.toUpperCase().trim();
	to = to.toUpperCase().trim();
	if (from === to) return 1;

	const cacheKey = `${from}_${to}`;
	const cached = rateCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.rate;
	}

	try {
		const rate =
			from === RUB_CODE || to === RUB_CODE
				? await fetchRubAwareRate(from, to)
				: await fetchCryptoCompareRate(from, to);

		rateCache.set(cacheKey, { rate, timestamp: Date.now() });
		return rate;
	} catch {
		if (cached) return cached.rate;
		throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch exchange rate for ${from}/${to}` });
	}
}

// Validate a currency code against the configured exchange-rate providers.
async function validateCurrencyCode(code: string): Promise<boolean> {
	try {
		if (code === RUB_CODE) {
			await fetchUsdRubRate();
			return true;
		}

		const rate = await fetchCryptoCompareRate(code, USD_CODE);
		return rate > 0;
	} catch {
		return false;
	}
}

export const currencyRouter = t.router({
	list: protectedProcedure.query(async () => {
		const currencies = await db.select().from(schema.currencies);
		return currencies.map(c => ({ code: c.code, symbol: c.symbol, isDefault: c.isDefault, id: c.id }));
	}),

	add: adminProcedure
		.input((v) => {
			const s = Type.Object({
				code: Type.String({ minLength: 1, maxLength: 10 }),
				symbol: Type.String({ minLength: 1, maxLength: 5 })
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { code: string; symbol: string };
		})
		.mutation(async ({ input }) => {
			const code = input.code.toUpperCase().trim();
			const symbol = input.symbol.trim();

			// Check if already exists
			const existing = await db.select().from(schema.currencies).where(eq(schema.currencies.code, code)).limit(1);
			if (existing.length > 0) {
				throw new TRPCError({ code: 'CONFLICT', message: `Currency ${code} already exists` });
			}

			// Validate against the same providers used for conversion.
			const isValid = await validateCurrencyCode(code);
			if (!isValid) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: `Currency code "${code}" is not valid. Exchange-rate providers returned no rate for it.` });
			}

			await db.insert(schema.currencies).values({
				id: crypto.randomUUID(),
				code,
				symbol,
				isDefault: false,
				createdAt: new Date()
			});

			return { success: true, code };
		}),

	remove: adminProcedure
		.input((v) => {
			const s = Type.Object({ id: Type.String({ minLength: 1 }) });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input }) => {
			const currency = await db.select().from(schema.currencies).where(eq(schema.currencies.id, input.id)).limit(1);
			if (currency.length === 0) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Currency not found' });
			}
			if (currency[0].isDefault) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete the default currency' });
			}
			await db.delete(schema.currencies).where(eq(schema.currencies.id, input.id));
			return { success: true };
		}),

	validate: adminProcedure
		.input((v) => {
			const s = Type.Object({ code: Type.String({ minLength: 1, maxLength: 10 }) });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { code: string };
		})
		.query(async ({ input }) => {
			const code = input.code.toUpperCase().trim();
			const isValid = await validateCurrencyCode(code);
			return { code, valid: isValid };
		}),

	convert: protectedProcedure
		.input((v) => {
			const s = Type.Object({
				amount: Type.Number({ minimum: 0 }),
				from: Type.String({ minLength: 1 }),
				to: Type.String({ minLength: 1 })
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { amount: number; from: string; to: string };
		})
		.query(async ({ input }) => {
			const rate = await fetchRate(input.from, input.to);
			return {
				amount: input.amount,
				from: input.from,
				to: input.to,
				rate,
				converted: +(input.amount * rate).toFixed(6)
			};
		}),

	getRate: protectedProcedure
		.input((v) => {
			const s = Type.Object({
				from: Type.String({ minLength: 1 }),
				to: Type.String({ minLength: 1 })
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { from: string; to: string };
		})
		.query(async ({ input }) => {
			const rate = await fetchRate(input.from, input.to);
			return { from: input.from, to: input.to, rate };
		})
});
