import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config([
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		},
		rules: {
			// Svelte 5 runes use `let { ... } = $props()` which shouldn't be const
			'prefer-const': 'off',
			// Navigation without resolve is fine for internal links
			'svelte/no-navigation-without-resolve': 'off',
			// Each key is optional in Svelte 5 when not needed for animations
			'svelte/require-each-key': 'off',
			// Allow any types in Svelte components (tRPC responses)
			'@typescript-eslint/no-explicit-any': 'off',
			// Allow unused vars with underscore prefix
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			// Allow $effect for dialog resets and side effects
			'svelte/prefer-writable-derived': 'off'
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'*.config.js',
			'*.config.ts'
		]
	},
	{
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-console': 'warn',
			'prefer-const': 'error',
			'no-var': 'error'
		}
	}
]);