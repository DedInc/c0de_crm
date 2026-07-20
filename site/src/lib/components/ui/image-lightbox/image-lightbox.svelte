<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Download from '@lucide/svelte/icons/download';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';

	interface Props {
		images: string[];
		initialIndex?: number;
		open: boolean;
		onClose: () => void;
	}

	let { images, initialIndex = 0, open = $bindable(false), onClose }: Props = $props();

	let currentIndex = $state(0);
	let scale = $state(1);

	$effect(() => {
		if (open) {
			currentIndex = initialIndex;
			scale = 1;
		}
	});

	function prev() {
		currentIndex = (currentIndex - 1 + images.length) % images.length;
		scale = 1;
	}

	function next() {
		currentIndex = (currentIndex + 1) % images.length;
		scale = 1;
	}

	function zoomIn() {
		scale = Math.min(scale + 0.5, 5);
	}

	function zoomOut() {
		scale = Math.max(scale - 0.5, 0.5);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		switch (e.key) {
			case 'Escape':
				onClose();
				break;
			case 'ArrowLeft':
				prev();
				break;
			case 'ArrowRight':
				next();
				break;
			case '+':
			case '=':
				zoomIn();
				break;
			case '-':
				zoomOut();
				break;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function downloadImage() {
		const link = document.createElement('a');
		link.href = images[currentIndex];
		link.download = `image-${currentIndex + 1}`;
		link.click();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open && images.length > 0}
	<div
		class="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Image viewer"
		tabindex="-1"
	>
		<!-- Top controls -->
		<div class="absolute top-4 right-4 flex items-center gap-2 z-10">
			<span class="text-white/70 text-sm mr-2">
				{currentIndex + 1} / {images.length}
			</span>
			<button
				type="button"
				class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
				onclick={zoomOut}
				title="Zoom out"
			>
				<ZoomOut class="h-5 w-5" />
			</button>
			<button
				type="button"
				class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
				onclick={zoomIn}
				title="Zoom in"
			>
				<ZoomIn class="h-5 w-5" />
			</button>
			<button
				type="button"
				class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
				onclick={downloadImage}
				title="Download"
			>
				<Download class="h-5 w-5" />
			</button>
			<button
				type="button"
				class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
				onclick={onClose}
				title="Close"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Navigation arrows -->
		{#if images.length > 1}
			<button
				type="button"
				class="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
				onclick={prev}
			>
				<ChevronLeft class="h-6 w-6" />
			</button>
			<button
				type="button"
				class="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
				onclick={next}
			>
				<ChevronRight class="h-6 w-6" />
			</button>
		{/if}

		<!-- Image -->
		<div class="max-w-[90vw] max-h-[85vh] overflow-auto flex items-center justify-center">
			<img
				src={images[currentIndex]}
				alt="Image {currentIndex + 1}"
				class="max-w-full max-h-[85vh] object-contain transition-transform duration-200 select-none"
				style="transform: scale({scale})"
				draggable="false"
			/>
		</div>
	</div>
{/if}
