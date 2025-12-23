<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Pagination } from '$lib/components/ui/pagination';
	import Search from '@lucide/svelte/icons/search';

	interface Order {
		id: string;
		title: string;
		description: string;
		cost: number;
		status: string;
		customerTelegramId: string;
		customerName: string | null;
		createdAt: string;
		markers: { id: string; name: string; color: string }[];
		assignedTo: { id: string; username: string } | null;
		responses: unknown[];
	}

	let orders = $state<Order[]>([]);
	let filteredOrders = $state<Order[]>([]);
	let markers = $state<{ id: string; name: string; color: string }[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let markerFilter = $state('all');

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(10);
	let totalPages = $derived(Math.ceil(filteredOrders.length / pageSize));

	const statuses = [
		'all',
		'pending_moderation',
		'rejected',
		'approved',
		'in_progress',
		'testing',
		'completed',
		'delivered'
	];

	onMount(async () => {
		try {
			const [ordersData, markersData] = await Promise.all([
				trpc.orders.list.query(),
				trpc.markers.list.query()
			]);
			orders = ordersData;
			markers = markersData;
			filterOrders();
		} catch (e) {
			console.error('Failed to load orders:', e);
		} finally {
			loading = false;
		}
	});

	function filterOrders() {
		filteredOrders = orders.filter(order => {
			const matchesSearch = searchQuery === '' ||
				order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				order.description.toLowerCase().includes(searchQuery.toLowerCase());
			
			const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
			
			const matchesMarker = markerFilter === 'all' ||
				order.markers.some(m => m.id === markerFilter);

			return matchesSearch && matchesStatus && matchesMarker;
		});
		// Reset to first page when filters change
		currentPage = 1;
	}

	// Derived state for paginated orders
	let displayedOrders = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		const end = start + pageSize;
		return filteredOrders.slice(start, end);
	});

	function handlePageChange(page: number) {
		currentPage = page;
	}

	function handlePageSizeChange(size: number) {
		pageSize = size;
		currentPage = 1;
	}

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

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('orders.title')}</h1>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="pt-6">
			<div class="flex flex-col md:flex-row gap-4">
				<div class="flex-1 relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder={$t('common.search')}
						class="pl-10"
						bind:value={searchQuery}
						oninput={filterOrders}
					/>
				</div>

				<Select.Root type="single" bind:value={statusFilter} onValueChange={filterOrders}>
					<Select.Trigger class="w-full md:w-48">
						{statusFilter === 'all' ? $t('orders.filterByStatus') : $t(`status.${statusFilter}`)}
					</Select.Trigger>
					<Select.Content>
						{#each statuses as status}
							<Select.Item value={status}>
								{status === 'all' ? $t('common.all') : $t(`status.${status}`)}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				<Select.Root type="single" bind:value={markerFilter} onValueChange={filterOrders}>
					<Select.Trigger class="w-full md:w-48">
						{markerFilter === 'all' ? $t('orders.filterByMarker') : markers.find(m => m.id === markerFilter)?.name}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">{$t('common.all')}</Select.Item>
						{#each markers as marker}
							<Select.Item value={marker.id}>
								<span class="flex items-center gap-2">
									<span class="w-3 h-3 rounded-full" style="background-color: {marker.color}"></span>
									{marker.name}
								</span>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Orders list -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if filteredOrders.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">{$t('orders.noOrders')}</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4">
			{#each displayedOrders as order}
				<a href="/orders/{order.id}">
					<Card.Root class="hover:bg-muted/50 transition-colors cursor-pointer">
						<Card.Content class="pt-6">
							<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
								<div class="space-y-2">
									<div class="flex items-center gap-2">
										<h3 class="font-semibold text-lg">{order.title}</h3>
										<Badge class={getStatusColor(order.status)}>
											{$t(`status.${order.status}`)}
										</Badge>
									</div>
									<p class="text-muted-foreground line-clamp-2">{order.description}</p>
									<div class="flex flex-wrap gap-2">
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
								<div class="flex flex-col items-end gap-2">
									<span class="text-2xl font-bold">${order.cost}</span>
									<span class="text-sm text-muted-foreground">
										{formatDate(order.createdAt)}
									</span>
									{#if order.assignedTo}
										<span class="text-sm">
											{$t('orders.assignedTo')}: {order.assignedTo.username}
										</span>
									{/if}
									{#if order.responses.length > 0}
										<Badge variant="secondary">
											{order.responses.length} {$t('orders.responses')}
										</Badge>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>

		{#if totalPages > 1}
			<Pagination
				{currentPage}
				{totalPages}
				totalItems={filteredOrders.length}
				{pageSize}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		{/if}
	{/if}
</div>