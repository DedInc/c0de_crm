<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

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

<Card.Root class="w-80 flex-shrink-0 flex flex-col">
	<Card.Header class="pb-2">
		<Card.Title class="text-lg">{$t('nav.orders')}</Card.Title>
	</Card.Header>
	<Card.Content class="flex-1 overflow-y-auto p-2">
		{#if orders.length === 0}
			<p class="text-center text-muted-foreground py-4 text-sm">
				{$t('orders.noOrders')}
			</p>
		{:else}
			<div class="space-y-1">
				{#each orders as order}
					<button
						onclick={() => onSelectOrder(order.id)}
						class="w-full text-left p-3 rounded-lg transition-colors {selectedOrderId === order.id
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
					>
						<div class="flex items-center justify-between mb-1">
							<span class="font-medium truncate">{order.title}</span>
							<Badge class="{getStatusColor(order.status)} text-xs">
								{$t(`status.${order.status}`)}
							</Badge>
						</div>
						<p class="text-xs opacity-70">
							{order.customerName || order.customerTelegramId}
						</p>
					</button>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>