/* eslint-disable no-eval */
/* eslint-disable no-restricted-imports */
import "./style.css"

import { crop } from "@alanscodelog/utils"
import { parseParserOptions } from "@witchcraft/expressit/helpers/parser/index.js"
import { prettyAst } from "@witchcraft/expressit/utils"

import { Parser } from "@witchcraft/expressit"


const body = document.body

body.innerHTML = `
<div class="container">
	<input class="input" spellcheck="false"/>
	<div class="options">
		<h2>Options</h2>
		<div class="options-group">
			<textarea class="options-raw">${crop(`
			{
				customPropertyOperators: [":", ">", "<"],
				expandedPropertySeparator: ":",
				prefixableStrings: ["num"]
			}`)}</textarea>
			<textarea class="options-parsed" disabled="true"></textarea>
		</div>
	</div>
	<div>
		<div class="suggestions">
		<div class="suggestions-heading"><h2>Suggestions</h2><span>(press Ctrl+Space to force suggestions at cursor)</span><span class="pos"></span></div>
			<div class="suggestion">
			</div>
		</div>
		<div class="completions">
		<div class="completions-heading"><h2>Completions</h2></div>
			<div class="completion">
			</div>
		</div>
	</div>
	<div>
		<div class="results-heading"><h2>Results</h2> <span class="time">(<span class="resultTime"></span>ms)</span></div>
		<div class="results">
			<div class="result resultSimple"></div>
			<div class="result resultFull"></div>
		</div>
	</div>
</div>
`

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
}

const els = {}

let opts
let parser
let ast
let first = true

function onInput(e) {
	const value = els.input.value
	let newOpts
	try {
		newOpts = getOpts()
	} catch (err) {
		return
	}
	let parserStart, parserPerf
	if (!parser || JSON.stringify(opts) !== JSON.stringify(newOpts)) {
		parserStart = performance.now()
		opts = newOpts
		parser = new Parser({ ...opts, cache: true })
		parserPerf = performance.now() - parserStart
	}
	if (first) {
		parserPerf = undefined
		first = false
	}
	let perf, start
	setTimeout(() => {
		try {
			start = performance.now()
			ast = parser.parse(value)
			perf = performance.now() - start
		} catch (err) {
			perf = performance.now() - start
			els.resultTime.innerHTML = perf.toFixed(2) + (parserPerf ? ` + ${parserPerf.toFixed(2)} (parser re-instantiated)` : "")
			els.resultFull.innerHTML = err.message
			els.resultSimple.innerHTML = "UNEXPECTED ERROR - Please file an issue =>"
			return
		}
		els.resultTime.innerHTML = perf.toFixed(2) + (parserPerf ? ` + ${parserPerf.toFixed(2)}(new parser instance) ` : "")
		els.resultFull.innerHTML = JSON.stringify(ast, null, "\t")
		const parsedString = prettyAst(ast, {}, {
			variable: "<span class=\"res-var\">",
			other: "<span class=\"res-other\">",
			position: "<span class=\"res-pos\">",
			reset: "</span>",
		})
		els.resultSimple.innerHTML = parsedString

		onKeyboardInput(e, true)
	}, 0)
}

function onKeyboardInput(e, force = false) {
	const input = els.input.value
	if (force || (e.code === "Space" && e.ctrlKey)) {
		e?.preventDefault?.()
		const index = e.target.selectionStart
		const suggestions = parser.autosuggest(input, ast, index)
		// console.log(suggestions)

		const header = {
			type: "Type",
			isError: "isError",
			range: "Range",
		}
		const str = [header, ...suggestions]
			.map(entry => crop`
				<div class="suggestion-entry">
					<div>${entry.type}</div>
					${entry.isError ? `<div>${entry.isError}</div>` : "<div></div>"}
					<div>${typeof entry.range === "string"
					? entry.range
					: `[${entry.range.start}, ${entry.range.end}]`
				}</div>
				</div>
			`)
			.join("\n")
		els.suggestion.innerHTML = str
		els.pos.innerHTML = ` (${index})`

		const autocompletions = parser.autocomplete(suggestions, {
			variables: ["variable", "variable requires quoting", "variable requires escaping \""],
			prefixes: ["prefix", "prefix requires quoting", "prefix requires escaping \""],
			properties: ["property", "property requires quoting", "property requires escaping \""],
			expandedPropertyOperators: ["wordOperator"],
			// keywords = this.options.keywords,
			// regexFlags =["i", "m", "u"],
			// quote = "\"",
		})
		console.log(autocompletions)

		const header2 = {
			value: "Value",
			replacement: "Replacement",
		}

		const str2 = [header2, ...autocompletions].map(entry => {
			const replacement = entry.replacement ?? parser.autoreplace(input, entry)
			const str = typeof replacement === "string"
				? replacement
				: `${escapeHtml(replacement.replacement.slice(0, replacement.cursor))
				}</span><span class="cursor">|</span><span>${escapeHtml(replacement.replacement.slice(replacement.cursor))}`

			const res = crop`
				<div class="completion-entry">
					<div>${entry.value}</div>
					<div><span>${str}</span></div>
				</div>
		`
			return res
		}).join("\n")
		els.completion.innerHTML = str2
	}
}

for (const name of ["container", "options-raw", "options-parsed", "input", "results", "resultSimple", "resultFull", "resultTime", "suggestion", "completion", "pos"]) {
	els[name] = body.querySelector(`.${name}`)
}
els.input.addEventListener("input", onInput)
els.input.addEventListener("keyup", onKeyboardInput)


els["options-raw"].addEventListener("input", onInput)
onInput({ target: { selectionStart: 0 } })

function getOpts() {
	try {
		let res
		eval(`res = ${els["options-raw"].value}`)
		// eslint-disable-next-line prefer-const
		res = parseParserOptions(res)
		els["options-parsed"].innerHTML = JSON.stringify(res, null, "\t")
		return res
	} catch (e) {
		els["options-parsed"].innerHTML = e.message
		throw e
	}
}
