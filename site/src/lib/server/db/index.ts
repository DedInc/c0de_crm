import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DATABASE_URL } from '$env/static/private';

const { Pool } = pg;

// Database pool configuration from environment (with optimized defaults)
const poolConfig = {
	min: parseInt(process.env.DB_POOL_MIN || '2', 10),
	max: parseInt(process.env.DB_POOL_MAX || '10', 10),
	idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
	connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '30000', 10),
	allowExitOnIdle: false
};

const pool = new Pool({
	connectionString: DATABASE_URL,
	min: poolConfig.min,
	max: poolConfig.max,
	idleTimeoutMillis: poolConfig.idleTimeoutMillis,
	connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
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
		const now = new Date();
		const adminId = crypto.randomUUID();
		
		// Create admin user
		// IMPORTANT: Change the default password immediately after first login!
		// Default credentials: admin / admin123
		await db.insert(schema.users).values({
			id: adminId,
			username: 'admin',
			passwordHash: hashSync('admin123', 10),
			createdAt: now,
			updatedAt: now
		});

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
			await db.insert(schema.permissions).values(perm).onConflictDoNothing();
		}

		// Create admin role with all permissions
		const adminRoleId = crypto.randomUUID();
		await db.insert(schema.roles).values({
			id: adminRoleId,
			name: 'Administrator',
			description: 'Full system access',
			createdAt: now
		});

		// Assign all permissions to admin role
		const allPerms = await db.select().from(schema.permissions);
		for (const perm of allPerms) {
			await db.insert(schema.rolePermissions).values({
				roleId: adminRoleId,
				permissionId: perm.id
			});
		}

		// Assign admin role to admin user
		await db.insert(schema.userRoles).values({
			userId: adminId,
			roleId: adminRoleId
		});

		// Create default Support role
		const supportRoleId = crypto.randomUUID();
		await db.insert(schema.roles).values({
			id: supportRoleId,
			name: 'Support',
			description: 'Customer support and order management',
			createdAt: now
		});

		const supportPerms = ['view_orders', 'chat_customers', 'moderate_orders', 'assign_orders', 'update_order_status', 'send_payment_info'];
		for (const permName of supportPerms) {
			const perm = allPerms.find(p => p.name === permName);
			if (perm) {
				await db.insert(schema.rolePermissions).values({
					roleId: supportRoleId,
					permissionId: perm.id
				});
			}
		}

		// Create default Programmer role
		const programmerRoleId = crypto.randomUUID();
		await db.insert(schema.roles).values({
			id: programmerRoleId,
			name: 'Programmer',
			description: 'Development team member',
			createdAt: now
		});

		const programmerPerms = ['view_orders', 'respond_orders'];
		for (const permName of programmerPerms) {
			const perm = allPerms.find(p => p.name === permName);
			if (perm) {
				await db.insert(schema.rolePermissions).values({
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
			await db.insert(schema.stackMarkers).values({
				id: crypto.randomUUID(),
				name: marker.name,
				color: marker.color,
				createdAt: now
			});
		}
	} else {
		// For existing databases, ensure new permissions exist
		await ensureNewPermissions();
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

// Run initialization
initializeDatabase().catch(() => {
	// Initialization error - handled silently
});