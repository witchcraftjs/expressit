import { tsEslintConfig, typescriptConfig } from "@alanscodelog/eslint-config"
export default tsEslintConfig(
	// https://github.com/AlansCodeLog/eslint-config
	...typescriptConfig,
	// RULE LINKS
	// Eslint: https://eslint.org/docs/rules/
	// Typescript: https://typescript-eslint.io/rules/
	// Vue: https://eslint.vuejs.org/rules/
)
