import { allFileTypes, tsEslintConfig, typescriptConfig } from "@alanscodelog/eslint-config"
export default tsEslintConfig(
	// https://github.com/AlansCodeLog/eslint-config
	...typescriptConfig,
	{
		files: [`**/*.{${allFileTypes.join(",")}}`],
		languageOptions: {
			parserOptions: {
				// eslint-disable-next-line camelcase
				EXPERIMENTAL_useProjectService: false,
				project: "./tsconfig.eslint.json",
			},
		},
		ignores: [
			// ...
		],
	},
	// RULE LINKS
	// Eslint: https://eslint.org/docs/rules/
	// Typescript: https://typescript-eslint.io/rules/
	// Vue: https://eslint.vuejs.org/rules/
)
