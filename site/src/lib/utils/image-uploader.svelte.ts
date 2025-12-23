import { onDestroy } from 'svelte';

export interface ImageUploadState {
	selectedImages: File[];
	imagePreviewUrls: string[];
	fileInputRef: HTMLInputElement | null;
}

export function createImageUploader() {
	let selectedImages = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			
			img.onload = () => {
				let width = img.width;
				let height = img.height;
				
				if (width > maxWidth) {
					height = (height * maxWidth) / width;
					width = maxWidth;
				}
				
				canvas.width = width;
				canvas.height = height;
				
				ctx?.drawImage(img, 0, 0, width, height);
				const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
				resolve(compressedDataUrl);
			};
			
			img.onerror = reject;
			img.src = URL.createObjectURL(file);
		});
	}

	async function uploadImage(file: File): Promise<string> {
		try {
			return await compressImage(file, 1200, 0.7);
		} catch {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
		}
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			for (const file of Array.from(files)) {
				if (!file.type.startsWith('image/')) {
					alert('Please select image files only');
					continue;
				}
				if (file.size > 5 * 1024 * 1024) {
					alert(`Image "${file.name}" is too large. Max size is 5MB.`);
					continue;
				}
				if (selectedImages.length >= 10) {
					alert('Maximum 10 images allowed');
					break;
				}
				selectedImages = [...selectedImages, file];
				imagePreviewUrls = [...imagePreviewUrls, URL.createObjectURL(file)];
			}
		}
	}

	function removeImage(index: number) {
		URL.revokeObjectURL(imagePreviewUrls[index]);
		selectedImages = selectedImages.filter((_, i) => i !== index);
		imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
	}

	function clearSelectedImages() {
		imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
		selectedImages = [];
		imagePreviewUrls = [];
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	function triggerImageSelect() {
		fileInputRef?.click();
	}

	async function uploadAllImages(): Promise<string[]> {
		return Promise.all(selectedImages.map(uploadImage));
	}

	onDestroy(() => {
		imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
	});

	return {
		get selectedImages() { return selectedImages },
		get imagePreviewUrls() { return imagePreviewUrls },
		get fileInputRef() { return fileInputRef },
		set fileInputRef(value: HTMLInputElement | null) { fileInputRef = value },
		handleImageSelect,
		removeImage,
		clearSelectedImages,
		triggerImageSelect,
		uploadAllImages
	};
}
