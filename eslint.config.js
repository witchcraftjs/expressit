import { typescriptConfig } from "@alanscodelog/eslint-config"
import { defineConfig } from "eslint/config"
export default defineConfig([
	// https://github.com/AlansCodeLog/eslint-config
	{
		extends: [typescriptConfig],
	}
	// {
	// 	files: [`**/*.{${allFileTypes.join(",")}}`],
	// },
	// RULE LINKS
	// Eslint: https://eslint.org/docs/rules/
	// Typescript: https://typescript-eslint.io/rules/
	// Vue: https://eslint.vuejs.org/rules/
])
