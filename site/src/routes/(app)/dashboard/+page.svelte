<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/auth';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Clock from '@lucide/svelte/icons/clock';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';

	interface OrderStats {
		total: number;
		pendingModeration: number;
		inProgress: number;
		completed: number;
	}

	let stats = $state<OrderStats>({
		total: 0,
		pendingModeration: 0,
		inProgress: 0,
		completed: 0
	});

	let recentOrders = $state<any[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const orders = await trpc.orders.list.query();
			
			stats = {
				total: orders.length,
				pendingModeration: orders.filter(o => o.status === 'pending_moderation').length,
				inProgress: orders.filter(o => o.status === 'in_progress').length,
				completed: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length
			};

			recentOrders = orders.slice(0, 5);
		} catch (e) {
			console.error('Failed to load dashboard data:', e);
		} finally {
			loading = false;
		}
	});

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			pending_moderation: 'status-pending_moderation',
			rejected: 'status-rejected',
			approved: 'status-approved',
			in_progress: 'status-in_progress',
			testing: 'status-testing',
			completed: 'status-completed',
			delivered: 'status-delivered'
		};
		return colors[status] || 'bg-muted text-muted-foreground';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold">{$t('dashboard.title')}</h1>
		<p class="text-muted-foreground">{$t('dashboard.welcome', { name: $user?.username || '' })}</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else}
		<!-- Stats cards -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{$t('dashboard.totalOrders')}</Card.Title>
					<ClipboardList class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stats.total}</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{$t('dashboard.pendingModeration')}</Card.Title>
					<AlertCircle class="h-4 w-4 text-status-pending" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stats.pendingModeration}</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{$t('dashboard.inProgress')}</Card.Title>
					<Clock class="h-4 w-4 text-status-in-progress" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stats.inProgress}</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">{$t('dashboard.completed')}</Card.Title>
					<CheckCircle class="h-4 w-4 text-status-completed" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{stats.completed}</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Recent orders -->
		<Card.Root>
			<Card.Header>
				<Card.Title>{$t('dashboard.recentOrders')}</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if recentOrders.length === 0}
					<p class="text-muted-foreground text-center py-4">{$t('orders.noOrders')}</p>
				{:else}
					<div class="space-y-4">
						{#each recentOrders as order}
							<a href="/orders/{order.id}" class="block">
								<div class="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
									<div class="space-y-1">
										<p class="font-medium">{order.title}</p>
										<div class="flex items-center gap-2">
											{#each order.markers as marker}
												<Badge 
													variant="outline" 
													style="border-color: {marker.color}; color: {marker.color}"
												>
													{marker.name}
												</Badge>
											{/each}
										</div>
									</div>
									<div class="flex items-center gap-4">
										<span class="font-bold">${order.cost}</span>
										<Badge class={getStatusColor(order.status)}>
											{$t(`status.${order.status}`)}
										</Badge>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>