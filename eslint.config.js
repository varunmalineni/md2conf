import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `eslint.config.js` is plain JavaScript and stays out of the type-aware
    // project on purpose; the rest of the tree is covered by tsconfig.json.
    ignores: ['coverage/**', 'dist/**', 'eslint.config.js'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
