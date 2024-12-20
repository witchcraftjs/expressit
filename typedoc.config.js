import fs from "fs"
import path from "path"

import pkg from "./package.json" with { type: "json" }


export default {
	githubPages: true,
	navigationLinks: {
		Github: pkg.repository,
		Issues: `${pkg.repository}/issues`,
		npm: `http://npmjs.com/${pkg.name}`,
	},
	readme: "README.md",
	logLevel: "Verbose",
	entryPoints: ["src/index.ts", ...fs.readdirSync("src")
		.filter(dir => fs.statSync(path.join("src", dir)).isDirectory())
		.map(dir => `src/${dir}/index.ts`)],
	out: "docs",
	excludePrivate: true,
	excludeExternals: true,
	// // temporarily turn off plugins (just setting plugin: [] will not work)
	// plugin: "none",
	validation: {
		invalidLink: true,
	},
	projectDocuments: [
		"docs-src/DEVELOPMENT.md",
	]
}
