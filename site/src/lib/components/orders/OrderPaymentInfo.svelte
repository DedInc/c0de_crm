<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { formatDateTime } from '$lib/utils/realtime';
	import CreditCard from '@lucide/svelte/icons/credit-card';

	interface PaymentInfo {
		id: string;
		paymentMethodName: string;
		paymentDetails: string;
		programmerAmount: number;
		commissionAmount: number;
		totalAmount: number;
		createdAt: string | Date;
		providedBy: { id: string; username: string } | null;
	}

	interface Props {
		paymentInfoList: PaymentInfo[];
	}

	let { paymentInfoList }: Props = $props();
</script>

{#if paymentInfoList.length > 0}
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<CreditCard class="h-5 w-5" />
				{$t('orderPayment.paymentInformation')}
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#each paymentInfoList as info, index}
				{#if index > 0}
					<Separator />
				{/if}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Badge variant="outline">{info.paymentMethodName}</Badge>
						<span class="text-xs text-muted-foreground">
							{formatDateTime(typeof info.createdAt === 'string' ? info.createdAt : info.createdAt.toISOString())}
						</span>
					</div>
					
					<div class="bg-muted p-3 rounded-md">
						<p class="text-sm font-medium mb-1">{$t('orderPayment.paymentDetails')}:</p>
						<p class="text-sm whitespace-pre-wrap font-mono">{info.paymentDetails}</p>
					</div>

					<div class="grid grid-cols-3 gap-4 text-sm">
						<div>
							<span class="text-muted-foreground">{$t('orderPayment.programmerAmount')}:</span>
							<span class="ml-2 font-medium">${info.programmerAmount}</span>
						</div>
						{#if info.commissionAmount > 0}
							<div>
								<span class="text-muted-foreground">{$t('orderPayment.commissionAmount')}:</span>
								<span class="ml-2 font-medium">${info.commissionAmount}</span>
							</div>
						{/if}
						<div>
							<span class="text-muted-foreground">{$t('orderPayment.totalAmount')}:</span>
							<span class="ml-2 font-bold text-primary">${info.totalAmount}</span>
						</div>
					</div>

					{#if info.providedBy}
						<p class="text-xs text-muted-foreground">
							{$t('orderPayment.providedBy')}: {info.providedBy.username}
						</p>
					{/if}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
{/if}