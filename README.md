
### 🚧 WORK IN PROGRESS 🚧

![Docs](https://github.com/alanscodelog/expressit/workflows/Docs/badge.svg)
![Build](https://github.com/alanscodelog/expressit/workflows/Build/badge.svg)
<!-- [![Release](https://github.com/alanscodelog/expressit/workflows/Release/badge.svg)](https://www.npmjs.com/package/TONAME) -->

Expressit is blazing fast, customizable, error-tolerant expression parser that creates safe to eval expressions + a few other goodies.

# [Docs](https://alanscodelog.github.io/expressit)
# Features
- **Error Recovery**
	- The parser is designed to recover from ALL errors, even **multiple** errors, making it easy to provide things like syntax highlighting.
- **Custom Operator Keywords**
	- You can use whatever keywords you want for the operators and their strictness (whether something like `oregano` will parse to `or egano` or `oregano` can be adjusted to allow the use of keywords (usually symbols) without whitespace).
- **Prefixed Group Parsing (optional)**
	- Adds the ability do `prefix(variable)` which gets expanded into `prefixvariable`. You can also customize how they get prefixed (e.g. you can make `prefix(variable)` expand to `prefix.variable` instead).
- **Custom Property Operator**
	- Extended with custom separator (e.g. `:`): `property:OP:value`.
	- Custom set (e.g. `=`, `>`, `<`, etc): `property=value`.
	- **Array(optional), Regex(optional), and Group Values**
		- Can be parsed alone, but intended for use with custom property operators: `prop=[val1, val2]`, `prop=/regex/flags`, `prop=(a || b)`.
- **Batteries Included**
	- Can `validate` (for syntax highlighting) and `evaluate` ASTs according to custom rules.
- **Autosuggest/complete/replace Helpers**
	- Never think about autocompletion ever again!
- **Other Useful Utility Functions:**
	- `extractTokens`, `getCursorInfo`, `getOppositeDelimiter`, `getSurroundingErrors` - useful for adding custom syntax highlighting.
	- `prettyAst` - pretty prints a compact version of the ast for debugging
	- other minor helpers - `isDelimiter`, `isQuote`, etc.
- **Pre-Configured Parsers** - Includes a pre-configured boolean parser (intended for parsing shortcut contexts in a similar way to VS Code).
- **Lots of Docs and Tests**

# Usage

```ts
import { Parser, ErrorToken } from "expressit"

const parser = new Parser({/* opts */})
	const context = {
		a: false,
		b: true
	}

	// USER INPUT
	const input = "a || b"
	const cursor = 1 // a| || b

	const ast = parser.parse(input)

	if (ast instanceof ErrorToken || !ast.valid) {
		// ...show regular errors (no input, missing tokens, etc)
	} else {
		// validation can be controlled by parser options
		const errors = parser.validate(ast)
		// ...show more complex errors, e.g. unknown variables, etc
	}

	// ON AUTOCOMPLETE
	const suggestions = parser.autosuggest(input, ast, cursor)
	const completions = parser.autocomplete(suggestions, {
		// known possible suggestions
		variables: ["c", "d", "e"],
		// can also be values, prefixes, keywords, properties, etc
	})
	// ...show completions

	// ON ENTER/SUBMIT
	const res = parser.evaluate(ast, context)
```
Many more examples can be found in the [tests](https://github.com/AlansCodeLog/expressit/blob/master/tests), and there's also some WIP pre-configured parsers in [src/examples](https://github.com/AlansCodeLog/expressit/blob/master/src/examples/) whose usage can be seen in [./test/examples.spec.ts](https://github.com/AlansCodeLog/expressit/blob/master/test/examples.spec.ts).

## [Development](./docs-src/DEVELOPMENT.md)

## Related

[Shortcuts Manager](https://github.com/alanscodelog/shortcuts-manager)

[Parsekey (shortcuts parser)](https://github.com/alanscodelog/parsekey)
