import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { validateEnv } from '$lib/server/env';

const { Pool } = pg;

// Validate environment on startup
const envResult = validateEnv();
if (!envResult.valid) {
	throw new Error(`Server cannot start: ${envResult.errors.join('; ')}`);
}

// Database pool configuration from environment (with optimized defaults)
const poolConfig = {
	min: parseInt(env.DB_POOL_MIN || '2', 10),
	max: parseInt(env.DB_POOL_MAX || '10', 10),
	idleTimeoutMillis: parseInt(env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
	connectionTimeoutMillis: parseInt(env.DB_POOL_CONNECTION_TIMEOUT || '30000', 10),
	statementTimeoutMillis: parseInt(env.DB_STATEMENT_TIMEOUT_MS || '0', 10),
	allowExitOnIdle: false
};

const dbUrl = env.DATABASE_URL!;
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const isRenderInternal = dbUrl.includes('dpg-') && !dbUrl.includes('.com'); 

const useSsl = !(isLocalhost || isRenderInternal);

const pool = new Pool({
	connectionString: dbUrl,
	ssl: useSsl ? {
		rejectUnauthorized: false,
		...(env.DB_CA_CERT ? { ca: env.DB_CA_CERT } : {})
	} : false,
	min: poolConfig.min,
	max: poolConfig.max,
	idleTimeoutMillis: poolConfig.idleTimeoutMillis,
	connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
	...(poolConfig.statementTimeoutMillis > 0 ? { statement_timeout: poolConfig.statementTimeoutMillis } : {}),
	allowExitOnIdle: poolConfig.allowExitOnIdle
});

// Pool event handlers for monitoring
pool.on('connect', () => {
	// Client connected to pool
});

pool.on('acquire', () => {
	// Client acquired from pool
});

pool.on('release', () => {
	// Client released back to pool
});

pool.on('remove', () => {
	// Client removed from pool
});

pool.on('error', () => {
	// Error on idle client - handled silently
});

// Export pool stats function for monitoring
export function getPoolStats() {
	return {
		totalCount: pool.totalCount,
		idleCount: pool.idleCount,
		waitingCount: pool.waitingCount
	};
}

export const db = drizzle(pool, { schema });

// Initialize database with default data
export async function initializeDatabase() {
	// Check if admin exists
	const existingAdmin = await db.select().from(schema.users).where(eq(schema.users.username, 'admin')).limit(1);
	
	if (existingAdmin.length === 0) {
		await db.transaction(async (tx) => {
		const now = new Date();
		const adminId = crypto.randomUUID();
		
		// Use ADMIN_DEFAULT_PASSWORD env var or generate a random password
		const defaultPassword = env.ADMIN_DEFAULT_PASSWORD || crypto.randomUUID().slice(0, 12);
		
		// Create admin user
		await tx.insert(schema.users).values({
			id: adminId,
			username: 'admin',
			passwordHash: hashSync(defaultPassword, 10),
			mustChangePassword: true,
			createdAt: now,
			updatedAt: now
		});

		process.stderr.write([
			'DEFAULT ADMIN ACCOUNT CREATED',
			'Username: admin',
			`Password: ${defaultPassword}`,
			'This password is shown only once.',
			'You will be required to change it on first login.'
		].join('\n') + '\n');

		// Create default permissions
		const defaultPermissions = [
			{ id: crypto.randomUUID(), name: 'manage_users', description: 'Create and manage user accounts' },
			{ id: crypto.randomUUID(), name: 'manage_roles', description: 'Create and manage roles' },
			{ id: crypto.randomUUID(), name: 'manage_markers', description: 'Create and manage stack markers' },
			{ id: crypto.randomUUID(), name: 'moderate_orders', description: 'Approve or reject orders' },
			{ id: crypto.randomUUID(), name: 'assign_orders', description: 'Assign orders to programmers' },
			{ id: crypto.randomUUID(), name: 'view_orders', description: 'View approved orders' },
			{ id: crypto.randomUUID(), name: 'respond_orders', description: 'Respond to orders with price proposals' },
			{ id: crypto.randomUUID(), name: 'chat_customers', description: 'Chat with customers' },
			{ id: crypto.randomUUID(), name: 'update_order_status', description: 'Update order status' },
			{ id: crypto.randomUUID(), name: 'send_payment_info', description: 'Send payment details to customers' }
		];

		for (const perm of defaultPermissions) {
			await tx.insert(schema.permissions).values(perm).onConflictDoNothing();
		}

		// Create admin role with all permissions
		const adminRoleId = crypto.randomUUID();
		await tx.insert(schema.roles).values({
			id: adminRoleId,
			name: 'Administrator',
			description: 'Full system access',
			createdAt: now,
			updatedAt: now
		});

		// Assign all permissions to admin role
		const allPerms = await tx.select().from(schema.permissions);
		for (const perm of allPerms) {
			await tx.insert(schema.rolePermissions).values({
				roleId: adminRoleId,
				permissionId: perm.id
			});
		}

		// Assign admin role to admin user
		await tx.insert(schema.userRoles).values({
			userId: adminId,
			roleId: adminRoleId
		});

		// Create default Support role
		const supportRoleId = crypto.randomUUID();
		await tx.insert(schema.roles).values({
			id: supportRoleId,
			name: 'Support',
			description: 'Customer support and order management',
			createdAt: now,
			updatedAt: now
		});

		const supportPerms = ['view_orders', 'chat_customers', 'moderate_orders', 'assign_orders', 'update_order_status', 'send_payment_info'];
		for (const permName of supportPerms) {
			const perm = allPerms.find(p => p.name === permName);
			if (perm) {
				await tx.insert(schema.rolePermissions).values({
					roleId: supportRoleId,
					permissionId: perm.id
				});
			}
		}

		// Create default Programmer role
		const programmerRoleId = crypto.randomUUID();
		await tx.insert(schema.roles).values({
			id: programmerRoleId,
			name: 'Programmer',
			description: 'Development team member',
			createdAt: now,
			updatedAt: now
		});

		const programmerPerms = ['view_orders', 'respond_orders'];
		for (const permName of programmerPerms) {
			const perm = allPerms.find(p => p.name === permName);
			if (perm) {
				await tx.insert(schema.rolePermissions).values({
					roleId: programmerRoleId,
					permissionId: perm.id
				});
			}
		}

		// Create some default stack markers
		const defaultMarkers = [
			{ name: 'Python', color: '#3776ab' },
			{ name: 'JavaScript', color: '#f7df1e' },
			{ name: 'TypeScript', color: '#3178c6' },
			{ name: 'Java', color: '#ed8b00' },
			{ name: 'React', color: '#61dafb' },
			{ name: 'Vue', color: '#4fc08d' },
			{ name: 'Svelte', color: '#ff3e00' },
			{ name: 'Node.js', color: '#339933' },
			{ name: 'PostgreSQL', color: '#336791' },
			{ name: 'MongoDB', color: '#47a248' }
		];

		for (const marker of defaultMarkers) {
			await tx.insert(schema.stackMarkers).values({
				id: crypto.randomUUID(),
				name: marker.name,
				color: marker.color,
				createdAt: now
			});
		}

		// Create default BTC payment method (system, cannot be deleted)
		await tx.insert(schema.paymentMethods).values({
			id: crypto.randomUUID(),
			name: 'BTC',
			details: '',
			isActive: true,
			isSystem: true,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now
		});

		// Seed default currencies
		const defaultCurrencies = [
			{ code: 'USD', symbol: '$', isDefault: true },
			{ code: 'EUR', symbol: '€', isDefault: false },
			{ code: 'RUB', symbol: '₽', isDefault: false },
			{ code: 'UAH', symbol: '₴', isDefault: false },
			{ code: 'CNY', symbol: '¥', isDefault: false },
			{ code: 'GBP', symbol: '£', isDefault: false },
			{ code: 'BTC', symbol: '₿', isDefault: false },
			{ code: 'ETH', symbol: 'Ξ', isDefault: false },
			{ code: 'USDT', symbol: '₮', isDefault: false }
		];
		for (const cur of defaultCurrencies) {
			await tx.insert(schema.currencies).values({
				id: crypto.randomUUID(),
				code: cur.code,
				symbol: cur.symbol,
				isDefault: cur.isDefault,
				createdAt: now
			});
		}
		});
	} else {
		// For existing databases, ensure new permissions exist
		await ensureNewPermissions();
		// Ensure default BTC payment method exists
		await ensureDefaultPaymentMethod();
		// Ensure currencies table is populated
		await ensureDefaultCurrencies();
	}
}

// Ensure new permissions exist for existing databases
async function ensureNewPermissions() {
	const newPermissions = [
		{ name: 'send_payment_info', description: 'Send payment details to customers' }
	];

	for (const perm of newPermissions) {
		const existing = await db.select().from(schema.permissions).where(eq(schema.permissions.name, perm.name)).limit(1);
		if (existing.length === 0) {
			await db.insert(schema.permissions).values({
				id: crypto.randomUUID(),
				name: perm.name,
				description: perm.description
			});
		}
	}
}

// Ensure default BTC payment method exists for existing databases
async function ensureDefaultPaymentMethod() {
	const systemMethods = await db
		.select()
		.from(schema.paymentMethods)
		.where(eq(schema.paymentMethods.isSystem, true))
		.limit(1);

	if (systemMethods.length === 0) {
		const now = new Date();
		await db.insert(schema.paymentMethods).values({
			id: crypto.randomUUID(),
			name: 'BTC',
			details: '',
			isActive: true,
			isSystem: true,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now
		});
	}
}

// Ensure currencies table is populated for existing databases
async function ensureDefaultCurrencies() {
	const existing = await db.select().from(schema.currencies).limit(1);
	if (existing.length === 0) {
		const now = new Date();
		const defaultCurrencies = [
			{ code: 'USD', symbol: '$', isDefault: true },
			{ code: 'EUR', symbol: '€', isDefault: false },
			{ code: 'RUB', symbol: '₽', isDefault: false },
			{ code: 'UAH', symbol: '₴', isDefault: false },
			{ code: 'CNY', symbol: '¥', isDefault: false },
			{ code: 'GBP', symbol: '£', isDefault: false },
			{ code: 'BTC', symbol: '₿', isDefault: false },
			{ code: 'ETH', symbol: 'Ξ', isDefault: false },
			{ code: 'USDT', symbol: '₮', isDefault: false }
		];
		for (const cur of defaultCurrencies) {
			await db.insert(schema.currencies).values({
				id: crypto.randomUUID(),
				code: cur.code,
				symbol: cur.symbol,
				isDefault: cur.isDefault,
				createdAt: now
			});
		}
	}
}

// Run initialization
if (!building) {
	initializeDatabase().catch((error) => {
		process.stderr.write(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}\n`);
	});
}
