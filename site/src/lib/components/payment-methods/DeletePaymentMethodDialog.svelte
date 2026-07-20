<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		open: boolean;
		paymentMethodName: string;
		deleting: boolean;
		onConfirm: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), paymentMethodName, deleting, onConfirm, onClose }: Props = $props();

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{$t('paymentMethods.deletePaymentMethod')}</Dialog.Title>
			<Dialog.Description>
				{$t('paymentMethods.confirmDelete', { name: paymentMethodName })}
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose} disabled={deleting}>
				{$t('common.cancel')}
			</Button>
			<Button variant="destructive" onclick={onConfirm} disabled={deleting}>
				{deleting ? $t('common.loading') : $t('common.delete')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>