<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import { user, hasPermission, isAdmin } from '$lib/stores/auth.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';

	import { toastError } from '$lib/stores/toast.svelte';
	import { CurrencyPrice } from '$lib/components/ui/currency-price';

	interface Order {
		id: string;
		title: string;
		description: string;
		cost: number;
		currency: string;
		status: string;
		customerName: string | null;
		markers: { id: string; name: string; color: string }[];
		assignedTo: { id: string; username: string } | null;
	}

	const columns = [
		{ id: 'approved', label: 'status.approved', color: 'kanban-border-approved' },
		{ id: 'in_progress', label: 'status.in_progress', color: 'kanban-border-in_progress' },
		{ id: 'testing', label: 'status.testing', color: 'kanban-border-testing' },
		{ id: 'completed', label: 'status.completed', color: 'kanban-border-completed' }
	] as const;

	type KanbanStatus = typeof columns[number]['id'];
	type KanbanTotals = Record<KanbanStatus, number>;

	const KANBAN_LIMIT_PER_STATUS = 50;
	const updateTargetStatuses = ['in_progress', 'testing', 'completed', 'delivered'] as const;
	type UpdateTargetStatus = typeof updateTargetStatuses[number];

	let orders = $state<Order[]>([]);
	let totals = $state<KanbanTotals>({
		approved: 0,
		in_progress: 0,
		testing: 0,
		completed: 0
	});
	let loading = $state(true);
	let draggedOrder = $state<Order | null>(null);

	onMount(async () => {
		try {
			const kanban = await trpc.orders.listKanban.query({ limitPerStatus: KANBAN_LIMIT_PER_STATUS });
			orders = kanban.items;
			totals = kanban.totals;
		} catch {
			toastError('Failed to load kanban orders');
		} finally {
			loading = false;
		}
	});

	function getOrdersByStatus(status: KanbanStatus): Order[] {
		return orders.filter(o => o.status === status);
	}

	function getHiddenCount(status: KanbanStatus): number {
		return Math.max(0, totals[status] - getOrdersByStatus(status).length);
	}

	function isUpdateTargetStatus(status: string): status is UpdateTargetStatus {
		return (updateTargetStatuses as readonly string[]).includes(status);
	}

	// Check if user can drag a specific order
	function canDragOrder(order: Order): boolean {
		// Admin or users with update_order_status permission can drag any order
		if (hasPermission('update_order_status') || isAdmin()) {
			return true;
		}
		// Assigned programmer can drag their own orders (only between in_progress and testing)
		if (order.assignedTo?.id === $user?.id) {
			return order.status === 'in_progress' || order.status === 'testing';
		}
		return false;
	}

	// Get valid transitions for a specific order based on user permissions
	function getValidTransitions(order: Order): string[] {
		const isAssignedProgrammer = order.assignedTo?.id === $user?.id &&
			!hasPermission('update_order_status') && !isAdmin();

		if (isAssignedProgrammer) {
			// Programmers can only move between in_progress and testing
			const programmerTransitions: Record<string, string[]> = {
				in_progress: ['testing'],
				testing: ['in_progress']
			};
			return programmerTransitions[order.status] || [];
		}

		// Full transitions for admin/support
		const fullTransitions: Record<string, string[]> = {
			approved: ['in_progress'],
			in_progress: ['testing'],
			testing: ['in_progress', 'completed'],
			completed: ['delivered']
		};
		return fullTransitions[order.status] || [];
	}

	function handleDragStart(e: DragEvent, order: Order) {
		if (!canDragOrder(order)) {
			e.preventDefault();
			return;
		}
		draggedOrder = order;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', order.id);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleDrop(e: DragEvent, newStatus: KanbanStatus) {
		e.preventDefault();
		if (!draggedOrder) return;
		if (draggedOrder.status === newStatus) return;

		// Check if user can update this order
		if (!canDragOrder(draggedOrder)) {
			draggedOrder = null;
			return;
		}

		// Check if this transition is valid for the user
		const validTransitions = getValidTransitions(draggedOrder);
		if (!validTransitions.includes(newStatus) || !isUpdateTargetStatus(newStatus)) {
			draggedOrder = null;
			return;
		}

		const orderToUpdate = draggedOrder;
		
		// Optimistically update the UI first
		orders = orders.map(o =>
			o.id === orderToUpdate.id ? { ...o, status: newStatus } : o
		);

		try {
			await trpc.orders.updateStatus.mutate({
				orderId: orderToUpdate.id,
				status: newStatus
			});
		} catch {
			toastError('Failed to update order status');
			// Revert on error
			orders = orders.map(o =>
				o.id === orderToUpdate.id ? { ...o, status: orderToUpdate.status } : o
			);
		}

		draggedOrder = null;
	}

	function handleDragEnd() {
		draggedOrder = null;
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">{$t('kanban.title')}</h1>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else}
		<div class="overflow-x-auto -mx-4 px-4 pb-4 md:overflow-x-visible">
			<div class="flex flex-col gap-4 md:grid md:grid-cols-4 md:min-w-0">
			{#each columns as column}
				<div
					class="bg-muted/50 rounded-lg p-4 min-h-[200px] md:min-h-[500px] border-t-4 {column.color}"
					ondragover={handleDragOver}
					ondrop={(e) => handleDrop(e, column.id)}
					role="region"
					aria-label={$t(column.label)}
				>
					<h3 class="font-semibold mb-4 flex items-center justify-between">
						{$t(column.label)}
						<Badge variant="secondary">{totals[column.id]}</Badge>
					</h3>

					<div class="space-y-3">
						{#each getOrdersByStatus(column.id) as order (order.id)}
							<div
								draggable={canDragOrder(order)}
								ondragstart={(e) => handleDragStart(e, order)}
								ondragend={handleDragEnd}
								class={canDragOrder(order) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
								role="button"
								tabindex="0"
							>
								<Card.Root class="hover:shadow-md transition-shadow {draggedOrder?.id === order.id ? 'opacity-50' : ''} {!canDragOrder(order) ? 'opacity-75' : ''}">
									<Card.Content class="p-4">
										<div class="flex items-start gap-2">
											<GripVertical class="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
											<div class="flex-1 min-w-0">
												<a href="/orders/{order.id}" class="font-medium hover:underline line-clamp-1">
													{order.title}
												</a>
												<p class="text-sm text-muted-foreground line-clamp-2 mt-1">
													{order.description}
												</p>
												<div class="flex flex-wrap gap-1 mt-2">
													{#each order.markers.slice(0, 2) as marker}
														<Badge 
															variant="outline" 
															class="text-xs"
															style="border-color: {marker.color}; color: {marker.color}"
														>
															{marker.name}
														</Badge>
													{/each}
													{#if order.markers.length > 2}
														<Badge variant="outline" class="text-xs">
															+{order.markers.length - 2}
														</Badge>
													{/if}
												</div>
												<div class="flex items-center justify-between mt-3">
													<CurrencyPrice amount={order.cost} currency={order.currency || 'USD'} class="text-sm" />
													{#if order.assignedTo}
														<span class="text-xs text-muted-foreground">
															{order.assignedTo.username}
														</span>
													{/if}
												</div>
											</div>
										</div>
									</Card.Content>
								</Card.Root>
							</div>
						{/each}

						{#if getOrdersByStatus(column.id).length === 0}
							<p class="text-center text-muted-foreground text-sm py-8">
								{$t('kanban.noOrdersInColumn')}
							</p>
						{/if}

						{#if getHiddenCount(column.id) > 0}
							<p class="text-center text-muted-foreground text-xs py-2">
								{$t('kanban.hiddenOrders', {
									limit: KANBAN_LIMIT_PER_STATUS,
									count: getHiddenCount(column.id)
								})}
							</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
		</div>
	{/if}
</div>