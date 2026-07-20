import { onDestroy } from 'svelte';
import { toastError, toastWarning } from '$lib/stores/toast.svelte';
import { uploadFileWithProgress, type UploadProgress } from './file-uploader.svelte';

export type { UploadProgress };

export function createImageUploader() {
	let selectedImages = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let progress = $state<UploadProgress>({
		uploading: false,
		currentFile: 0,
		totalFiles: 0,
		fileProgress: 0,
		overallProgress: 0,
		currentFileName: ''
	});

	async function compressImageToBlob(file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<Blob> {
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

				canvas.toBlob(
					(blob) => {
						URL.revokeObjectURL(img.src);
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Failed to compress image'));
						}
					},
					'image/jpeg',
					quality
				);
			};

			img.onerror = () => {
				URL.revokeObjectURL(img.src);
				reject(new Error('Failed to load image'));
			};
			img.src = URL.createObjectURL(file);
		});
	}

	function addImages(files: File[]) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				toastError('Please select image files only');
				continue;
			}
			if (file.size > 5 * 1024 * 1024) {
				toastWarning(`Image "${file.name}" is too large. Max size is 5MB.`);
				continue;
			}
			if (selectedImages.length >= 10) {
				toastWarning('Maximum 10 images allowed');
				break;
			}
			selectedImages = [...selectedImages, file];
			imagePreviewUrls = [...imagePreviewUrls, URL.createObjectURL(file)];
		}
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			addImages(Array.from(files));
		}
		if (input) input.value = '';
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

	async function uploadAllImages(orderId: string): Promise<string[]> {
		const total = selectedImages.length;
		const results: string[] = [];

		progress = {
			uploading: true,
			currentFile: 0,
			totalFiles: total,
			fileProgress: 0,
			overallProgress: 0,
			currentFileName: ''
		};

		try {
			for (let i = 0; i < total; i++) {
				const file = selectedImages[i];
				progress = { ...progress, currentFile: i + 1, currentFileName: file.name, fileProgress: 0 };

				let blob: Blob;
				try {
					blob = await compressImageToBlob(file, 1200, 0.7);
				} catch {
					blob = file;
				}

				const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
				const uploadName = file.name.endsWith(ext) ? file.name : `${file.name}${ext}`;

				const data = await uploadFileWithProgress(blob, uploadName, orderId, (percent) => {
					progress = {
						...progress,
						fileProgress: percent,
						overallProgress: Math.round(((i + percent / 100) / total) * 100)
					};
				});

				results.push(data.key);
			}

			progress = { ...progress, overallProgress: 100 };
		} finally {
			setTimeout(() => {
				progress = { uploading: false, currentFile: 0, totalFiles: 0, fileProgress: 0, overallProgress: 0, currentFileName: '' };
			}, 500);
		}

		return results;
	}

	onDestroy(() => {
		imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
	});

	return {
		get selectedImages() { return selectedImages },
		get imagePreviewUrls() { return imagePreviewUrls },
		get fileInputRef() { return fileInputRef },
		set fileInputRef(value: HTMLInputElement | null) { fileInputRef = value },
		get progress() { return progress },
		addImages,
		handleImageSelect,
		removeImage,
		clearSelectedImages,
		triggerImageSelect,
		uploadAllImages
	};
}
