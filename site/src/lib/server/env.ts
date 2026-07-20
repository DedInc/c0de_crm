/**
 * Environment variable validation.
 * Called at server startup to fail fast on missing configuration.
 */

import { env } from '$env/dynamic/private';

interface EnvVarConfig {
	name: string;
	required: boolean;
	description: string;
}

const ENV_VARS: EnvVarConfig[] = [
	{ name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
	{ name: 'INTERNAL_API_KEY', required: true, description: 'Shared secret for CRM <-> Bot service auth' },
	{ name: 'BOT_TOKEN', required: false, description: 'Telegram bot token for image proxy' },
	{ name: 'BOT_WEBHOOK_URL', required: false, description: 'Bot webhook URL for sending messages' },
	{ name: 'CRM_BASE_URL', required: false, description: 'Public CRM URL for links in notifications' },
	{ name: 'CACHE_ENABLED', required: false, description: 'Enable Redis/Dragonfly caching (true/false)' },
	{ name: 'REDIS_URL', required: false, description: 'Redis connection URL (required if CACHE_ENABLED=true)' },
	{ name: 'R2_ACCOUNT_ID', required: false, description: 'Cloudflare account ID for R2 storage' },
	{ name: 'R2_ACCESS_KEY_ID', required: false, description: 'R2 access key ID' },
	{ name: 'R2_SECRET_ACCESS_KEY', required: false, description: 'R2 secret access key' },
	{ name: 'R2_BUCKET_NAME', required: false, description: 'R2 bucket name for file uploads' },
];

const KNOWN_INSECURE_DEFAULTS = ['change_me', 'change_me_in_production', 'change_me_to_a_random_secret'];

function writeDiagnostic(kind: 'error' | 'warning', lines: string[]): void {
	const icon = kind === 'error' ? 'ERROR' : 'WARNING';
	process.stderr.write(`\n${icon}: Environment ${kind}s:\n`);
	for (const line of lines) {
		process.stderr.write(`  - ${line}\n`);
	}
}

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	for (const v of ENV_VARS) {
		const value = env[v.name];
		if (!value || value.trim() === '') {
			if (v.required) {
				errors.push(`Missing required env var: ${v.name} — ${v.description}`);
			} else {
				warnings.push(`Optional env var not set: ${v.name} — ${v.description}`);
			}
		}
	}

	// F5-5: Reject known insecure default values for secrets
	if (env.INTERNAL_API_KEY && KNOWN_INSECURE_DEFAULTS.includes(env.INTERNAL_API_KEY)) {
		errors.push('INTERNAL_API_KEY is set to an insecure default value — generate a proper secret with: openssl rand -hex 32');
	}

	// Conditional: if cache is enabled, REDIS_URL is required
	if (env.CACHE_ENABLED === 'true' && (!env.REDIS_URL || env.REDIS_URL.trim() === '')) {
		errors.push('CACHE_ENABLED=true but REDIS_URL is not set');
	}

	// Conditional: if any R2 var is set, all must be set
	const r2Vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
	const r2Set = r2Vars.filter(v => env[v] && env[v]!.trim() !== '');
	if (r2Set.length > 0 && r2Set.length < r2Vars.length) {
		const missing = r2Vars.filter(v => !r2Set.includes(v));
		errors.push(`Partial R2 configuration: missing ${missing.join(', ')}`);
	}

	if (errors.length > 0) {
		writeDiagnostic('error', errors);
	}
	if (warnings.length > 0) {
		writeDiagnostic('warning', warnings);
	}

	return { valid: errors.length === 0, errors, warnings };
}
