<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';

	interface Props {
		open: boolean;
		isEditing: boolean;
		formName: string;
		formColor: string;
		submitting: boolean;
		formError: string;
		onSubmit: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		isEditing,
		formName = $bindable(),
		formColor = $bindable(),
		submitting,
		formError,
		onSubmit,
		onClose
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>
				{isEditing ? $t('markers.editMarker') : $t('markers.newMarker')}
			</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if formError}
				<div class="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
					{formError}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="name">{$t('markers.markerName')}</Label>
				<Input id="name" bind:value={formName} placeholder={$t('markers.markerName')} />
			</div>

			<div class="space-y-2">
				<Label for="color">{$t('markers.color')}</Label>
				<div class="flex gap-2">
					<input
						type="color"
						id="color"
						bind:value={formColor}
						class="w-12 h-10 rounded border cursor-pointer"
					/>
					<Input bind:value={formColor} placeholder="#000000" class="flex-1" />
				</div>
			</div>

			<div class="pt-2">
				<p class="text-sm text-muted-foreground mb-2">{$t('markers.preview')}:</p>
				<Badge variant="outline" style="border-color: {formColor}; color: {formColor}">
					{formName || $t('markers.markerName')}
				</Badge>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.cancel')}
			</Button>
			<Button onclick={onSubmit} disabled={submitting}>
				{$t('common.save')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>