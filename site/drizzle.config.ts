import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
	throw new Error('DATABASE_URL environment variable is required. Set it in site/.env');
}

const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: dbUrl,
		ssl: isLocalhost ? false : { rejectUnauthorized: false }
	}
});