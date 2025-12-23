<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';

	interface User {
		id: string;
		username: string;
	}

	interface Props {
		open: boolean;
		selectedUserId: string;
		users: User[];
		assigning: boolean;
		onAssign: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		selectedUserId = $bindable(),
		users,
		assigning,
		onAssign,
		onClose
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{$t('orders.assign')}</Dialog.Title>
		</Dialog.Header>
		<div class="py-4">
			<Select.Root type="single" bind:value={selectedUserId}>
				<Select.Trigger class="w-full">
					{selectedUserId
						? users.find((u) => u.id === selectedUserId)?.username
						: $t('orders.assignedTo')}
				</Select.Trigger>
				<Select.Content>
					{#each users as u}
						<Select.Item value={u.id}>{u.username}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.cancel')}
			</Button>
			<Button onclick={onAssign} disabled={assigning || !selectedUserId}>
				{$t('orders.assign')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>