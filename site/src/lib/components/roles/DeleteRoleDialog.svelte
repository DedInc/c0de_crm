<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open: boolean;
		onDelete: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), onDelete, onClose }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{$t('roles.deleteRole')}</Dialog.Title>
			<Dialog.Description>
				{$t('roles.confirmDelete')}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.cancel')}
			</Button>
			<Button variant="destructive" onclick={onDelete}>
				{$t('common.delete')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>