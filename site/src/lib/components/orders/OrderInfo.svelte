<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { getStatusColor, formatDateTime } from '$lib/utils/realtime';

	interface PaymentMethodDetails {
		id: string;
		name: string;
		details: string;
	}

	interface Order {
		id: string;
		title: string;
		description: string;
		cost: number;
		status: string;
		paymentMethod: string | null;
		paymentMethodDetails?: PaymentMethodDetails | null;
		customerTelegramId: string;
		customerName: string | null;
		createdAt: string;
		updatedAt: string;
		markers: { id: string; name: string; color: string }[];
		assignedTo: { id: string; username: string } | null;
	}

	interface Props {
		order: Order;
	}

	let { order }: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-start justify-between">
			<div>
				<Card.Title class="text-2xl">{order.title}</Card.Title>
				<div class="flex items-center gap-2 mt-2">
					<Badge class={getStatusColor(order.status)}>
						{$t(`status.${order.status}`)}
					</Badge>
					{#each order.markers as marker}
						<Badge variant="outline" style="border-color: {marker.color}; color: {marker.color}">
							{marker.name}
						</Badge>
					{/each}
				</div>
			</div>
			<span class="text-3xl font-bold">${order.cost}</span>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<div>
				<h4 class="font-medium mb-2">{$t('orders.description')}</h4>
				<p class="text-muted-foreground whitespace-pre-wrap">{order.description}</p>
			</div>

			<Separator />

			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<span class="text-muted-foreground">{$t('orders.customer')}:</span>
					<span class="ml-2">{order.customerName || order.customerTelegramId}</span>
				</div>
				{#if order.paymentMethodDetails}
					<div class="col-span-2">
						<span class="text-muted-foreground">{$t('orders.paymentMethod')}:</span>
						<span class="ml-2 font-medium">{order.paymentMethodDetails.name}</span>
						<p class="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{order.paymentMethodDetails.details}</p>
					</div>
				{:else if order.paymentMethod}
					<div>
						<span class="text-muted-foreground">{$t('orders.paymentMethod')}:</span>
						<span class="ml-2">{order.paymentMethod}</span>
					</div>
				{/if}
				<div>
					<span class="text-muted-foreground">{$t('orders.createdAt')}:</span>
					<span class="ml-2">{formatDateTime(order.createdAt)}</span>
				</div>
				<div>
					<span class="text-muted-foreground">{$t('orders.updatedAt')}:</span>
					<span class="ml-2">{formatDateTime(order.updatedAt)}</span>
				</div>
				{#if order.assignedTo}
					<div>
						<span class="text-muted-foreground">{$t('orders.assignedTo')}:</span>
						<span class="ml-2">{order.assignedTo.username}</span>
					</div>
				{/if}
			</div>
		</div>
	</Card.Content>
</Card.Root>