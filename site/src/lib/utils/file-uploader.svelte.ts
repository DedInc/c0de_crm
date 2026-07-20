import { toastError, toastWarning } from '$lib/stores/toast.svelte';

const ALLOWED_FILE_TYPES = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'text/plain',
	'application/zip',
	'application/x-rar-compressed',
	'application/vnd.rar',
	'application/x-7z-compressed',
	'application/gzip',
	'application/x-tar'
];

const ALLOWED_EXTENSIONS = [
	'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
	'.txt', '.zip', '.rar', '.7z', '.gz', '.tar'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface SelectedFile {
	file: File;
	name: string;
	type: string;
	size: number;
}

export interface UploadedFile {
	url: string;
	name: string;
	type: string;
}

export interface UploadProgress {
	uploading: boolean;
	currentFile: number;
	totalFiles: number;
	fileProgress: number;
	overallProgress: number;
	currentFileName: string;
}

function getFileExtension(name: string): string {
	const idx = name.lastIndexOf('.');
	return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function isAllowedFile(file: File): boolean {
	if (ALLOWED_FILE_TYPES.includes(file.type)) return true;
	const ext = getFileExtension(file.name);
	return ALLOWED_EXTENSIONS.includes(ext);
}

function uploadFileWithProgress(
	file: File | Blob,
	filename: string,
	orderId: string,
	onProgress: (percent: number) => void
): Promise<{ key: string; size: number; contentType: string }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();
		formData.append('file', file, filename);
		formData.append('orderId', orderId);

		xhr.upload.addEventListener('progress', (event) => {
			if (event.lengthComputable) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		});

		xhr.addEventListener('load', () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText));
				} catch {
					reject(new Error('Invalid server response'));
				}
			} else {
				try {
					const err = JSON.parse(xhr.responseText);
					reject(new Error(err.error || `Upload failed (${xhr.status})`));
				} catch {
					reject(new Error(`Upload failed (${xhr.status})`));
				}
			}
		});

		xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
		xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

		xhr.open('POST', '/api/upload');
		xhr.send(formData);
	});
}

export function createFileUploader() {
	let selectedFiles = $state<SelectedFile[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let progress = $state<UploadProgress>({
		uploading: false,
		currentFile: 0,
		totalFiles: 0,
		fileProgress: 0,
		overallProgress: 0,
		currentFileName: ''
	});

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			for (const file of Array.from(files)) {
				if (!isAllowedFile(file)) {
					toastError(`Unsupported file type: ${file.name}\nAllowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
					continue;
				}
				if (file.size > MAX_FILE_SIZE) {
					toastWarning(`File "${file.name}" is too large. Max size is 10MB.`);
					continue;
				}
				if (selectedFiles.length >= 5) {
					toastWarning('Maximum 5 files allowed');
					break;
				}
				selectedFiles = [...selectedFiles, {
					file,
					name: file.name,
					type: file.type || 'application/octet-stream',
					size: file.size
				}];
			}
		}
		if (input) input.value = '';
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	function clearSelectedFiles() {
		selectedFiles = [];
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	function triggerFileSelect() {
		fileInputRef?.click();
	}

	async function uploadAllFiles(orderId: string): Promise<UploadedFile[]> {
		const results: UploadedFile[] = [];
		const total = selectedFiles.length;

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
				const sf = selectedFiles[i];
				progress = { ...progress, currentFile: i + 1, currentFileName: sf.name, fileProgress: 0 };

				const data = await uploadFileWithProgress(sf.file, sf.name, orderId, (percent) => {
					progress = {
						...progress,
						fileProgress: percent,
						overallProgress: Math.round(((i + percent / 100) / total) * 100)
					};
				});

				results.push({ url: data.key, name: sf.name, type: sf.type });
			}

			progress = { ...progress, overallProgress: 100 };
		} finally {
			setTimeout(() => {
				progress = { uploading: false, currentFile: 0, totalFiles: 0, fileProgress: 0, overallProgress: 0, currentFileName: '' };
			}, 500);
		}

		return results;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	return {
		get selectedFiles() { return selectedFiles; },
		get fileInputRef() { return fileInputRef; },
		set fileInputRef(value: HTMLInputElement | null) { fileInputRef = value; },
		get progress() { return progress; },
		handleFileSelect,
		removeFile,
		clearSelectedFiles,
		triggerFileSelect,
		uploadAllFiles,
		formatFileSize
	};
}

export { uploadFileWithProgress };
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.join(',') + ',' + ALLOWED_FILE_TYPES.join(',');
