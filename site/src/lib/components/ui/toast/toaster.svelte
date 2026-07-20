<script lang="ts">
	import { toasts, dismissToast, type ToastType } from '$lib/stores/toast.svelte';
	import X from '@lucide/svelte/icons/x';
	import CheckCircle from '@lucide/svelte/icons/check-circle-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Info from '@lucide/svelte/icons/info';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	const iconMap: Record<ToastType, typeof CheckCircle> = {
		success: CheckCircle,
		error: AlertCircle,
		info: Info,
		warning: AlertTriangle
	};

	const colorMap: Record<ToastType, string> = {
		success: 'bg-emerald-600 text-white',
		error: 'bg-destructive text-white',
		info: 'bg-primary text-primary-foreground',
		warning: 'bg-amber-500 text-white'
	};
</script>

<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
	{#each $toasts as t (t.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg {colorMap[t.type]} animate-in slide-in-from-right-full duration-300"
			role="alert"
		>
			<svelte:component this={iconMap[t.type]} class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<p class="text-sm flex-1 leading-snug">{t.message}</p>
			<button
				type="button"
				class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
				onclick={() => dismissToast(t.id)}
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
