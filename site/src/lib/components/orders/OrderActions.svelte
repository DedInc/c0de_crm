<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Shield from '@lucide/svelte/icons/shield';
	import CreditCard from '@lucide/svelte/icons/credit-card';

	interface Props {
		orderId: string;
		canModerate: boolean;
		canRespond: boolean;
		canAssign: boolean;
		canUpdateStatus: boolean;
		canManagePermissions?: boolean;
		canChat?: boolean;
		canSendPayment?: boolean;
		nextStatuses: string[];
		updatingStatus: boolean;
		onApprove: () => void;
		onReject: () => void;
		onOpenResponse: () => void;
		onOpenAssign: () => void;
		onStatusUpdate: (status: string) => void;
		onOpenPermissions?: () => void;
		onOpenPaymentInfo?: () => void;
	}

	let {
		orderId,
		canModerate,
		canRespond,
		canAssign,
		canUpdateStatus,
		canManagePermissions = false,
		canChat = false,
		canSendPayment = false,
		nextStatuses,
		updatingStatus,
		onApprove,
		onReject,
		onOpenResponse,
		onOpenAssign,
		onStatusUpdate,
		onOpenPermissions,
		onOpenPaymentInfo
	}: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{$t('common.actions')}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		{#if canModerate}
			<Button class="w-full" onclick={onApprove}>
				<Check class="h-4 w-4 mr-2" />
				{$t('orders.approve')}
			</Button>
			<Button variant="destructive" class="w-full" onclick={onReject}>
				<X class="h-4 w-4 mr-2" />
				{$t('orders.reject')}
			</Button>
		{/if}

		{#if canRespond}
			<Button class="w-full" onclick={onOpenResponse}>
				<MessageSquare class="h-4 w-4 mr-2" />
				{$t('orders.respond')}
			</Button>
		{/if}

		{#if canAssign}
			<Button variant="outline" class="w-full" onclick={onOpenAssign}>
				<UserPlus class="h-4 w-4 mr-2" />
				{$t('orders.assign')}
			</Button>
		{/if}

		{#if canManagePermissions && onOpenPermissions}
			<Button variant="outline" class="w-full" onclick={onOpenPermissions}>
				<Shield class="h-4 w-4 mr-2" />
				{$t('orders.managePermissions')}
			</Button>
		{/if}

		{#if canSendPayment && onOpenPaymentInfo}
			<Button variant="default" class="w-full" onclick={onOpenPaymentInfo}>
				<CreditCard class="h-4 w-4 mr-2" />
				{$t('orderPayment.sendPaymentInfo')}
			</Button>
		{/if}

		{#if canUpdateStatus}
			<Separator />
			<p class="text-sm text-muted-foreground">{$t('orders.status')}:</p>
			{#each nextStatuses as nextStatus}
				<Button
					variant="outline"
					class="w-full"
					onclick={() => onStatusUpdate(nextStatus)}
					disabled={updatingStatus}
				>
					{$t(`status.${nextStatus}`)}
				</Button>
			{/each}
		{/if}

		{#if canChat}
			<Separator />
			<Button variant="secondary" class="w-full" onclick={() => goto(`/chat?order=${orderId}`)}>
				<MessageSquare class="h-4 w-4 mr-2" />
				{$t('nav.chat')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>