import tseslint from 'typescript-eslint'
export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-object-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  } },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: {
    __WALLET_DEMO__: 'readonly',
  } } },
)
