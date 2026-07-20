<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import Search from '@lucide/svelte/icons/search';
	import MessageSquare from '@lucide/svelte/icons/message-square';

	interface Order {
		id: string;
		title: string;
		status: string;
		customerName: string | null;
		customerTelegramId: string;
	}

	interface Props {
		orders: Order[];
		selectedOrderId: string | null;
		onSelectOrder: (orderId: string) => void;
	}

	let { orders, selectedOrderId, onSelectOrder }: Props = $props();
	let searchQuery = $state('');

	let filteredOrders = $derived(
		searchQuery.trim()
			? orders.filter(o => {
				const q = searchQuery.toLowerCase();
				return o.title.toLowerCase().includes(q) ||
					(o.customerName || '').toLowerCase().includes(q) ||
					o.customerTelegramId.toLowerCase().includes(q);
			})
			: orders
	);

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

<Card.Root class="w-80 max-w-full flex-shrink-0 flex flex-col">
	<Card.Header class="pb-2">
		<Card.Title class="text-lg">{$t('nav.orders')}</Card.Title>
		<div class="relative mt-2">
			<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				placeholder={$t('common.search')}
				class="pl-9 h-9"
			/>
		</div>
	</Card.Header>
	<Card.Content class="flex-1 overflow-y-auto p-2">
		{#if orders.length === 0}
			<div class="text-center text-muted-foreground py-8">
				<MessageSquare class="h-10 w-10 mx-auto mb-3 opacity-50" />
				<p class="text-sm">{$t('orders.noOrders')}</p>
			</div>
		{:else if filteredOrders.length === 0}
			<p class="text-center text-muted-foreground py-4 text-sm">
				{$t('common.noResults')}
			</p>
		{:else}
			<div class="space-y-1">
				{#each filteredOrders as order}
					<button
						onclick={() => onSelectOrder(order.id)}
						class="w-full text-left p-3 rounded-lg transition-colors {selectedOrderId === order.id
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
					>
						<div class="flex items-center justify-between mb-1 gap-2">
							<span class="font-medium truncate">{order.title}</span>
							<Badge class="{getStatusColor(order.status)} text-xs flex-shrink-0">
								{$t(`status.${order.status}`)}
							</Badge>
						</div>
						<p class="text-xs opacity-70 truncate">
							{order.customerName || order.customerTelegramId}
						</p>
					</button>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>