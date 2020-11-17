/* eslint-disable prefer-rest-params */
import { AddParameters, colors as color } from "@alanscodelog/utils"
import { isBlank, unreachable } from "@utils/utils"

import { ArrayNode, ConditionNode, ErrorToken, ExpressionNode, GroupNode, ValidToken, VariableNode } from "@/ast/classes"
import { AnyToken, ParserResults, TOKEN_TYPE } from "@/types"


type Colors = {
	/** Color used to highlight the actual text content of the token nodes. */
	values: string
	/** Color used to highlight the extra information some nodes contain in their headers for a quick overview (e.g. which operator for expression nodes, if a condition/group value is true, how long an array value is etc). */
	info: string
	position: string
	/** Color used to highlight the hints in parens that indicate how the node is being used (e.g. a variable node might be a property, or alone as a variable, etc) */
	hint: string
	error: string
	/** Color used to reset highlights. */
	reset: string
}

const defaultColors: Colors = {
	values: color.yellow,
	info: color.cyan,
	position: color.green,
	hint: color.blue,
	error: color.red,
	reset: color.reset,
}
const disableColors: Colors = Object.fromEntries(Object.keys(defaultColors).map(key => [key, ""])) as Colors

const toRows = (rows: string[], opts: Required<NonNullable<Parameters<typeof prettyAst>[1]>>): string[] => {
	rows = rows.filter(child => child !== "")

	return [
		...rows.slice(0, rows.length - 1).map(child => `${opts.indent}${opts.children}${child}`),
		`${opts.indent}${opts.last}${rows[rows.length - 1]}`,
	]
}
/**
 * Returns a more compressed, color coded, string representation of the ast for debugging.
 *
 * There are options to change which symbols are used for tree and if the variables are surrounded by quotes (default false).
 *
 * Colors can changed by passing ansi codes (or whatever you want\*) to the third parameter. Or you can pass false instead of an object to disable them. Default colors are:
 * ```ts
 * {
 * 	values: // yellow,
 * 	position: // green,
 * 	info: // cyan,
 * 	hint: // blue,
 * 	error: // red,
 * 	reset: // ansi reset code
 * }
 * ```
 * \* For example, you could pass html tags to show this in the browser instead (this is how the demo works). This is why the reset color is exposed. For example, a color might be `<span class="error">` and reset can be `</span>`.
 */

export function prettyAst(
	ast: ParserResults | AnyToken | VariableNode | ArrayNode | GroupNode,
	{ indent = "   ", children = "├╴", last = "└╴", branch = "│", quote = "" }: Partial<Record<"indent" | "children" | "last" | "branch" | "quote", string>> = {},
	colors: Partial<Colors> | false = {},
): string {
	const opts = { indent, children, last, branch, quote }
	const c: Colors = colors ? { ...defaultColors, ...colors } : disableColors
	const pos = `${c.position}(${ast.start}, ${ast.end})${c.reset}`
	const _ = indent
	// accumulated indent
	const __: string = arguments[3] ?? ""
	let extra: string = arguments[4] ?? ""
	if (!isBlank(extra)) extra = ` ${c.hint}${extra}${c.reset}`
	// indent to add to children items
	const ___ = __ + _ + branch
	// indent to add to last child item
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const __L = __ + _ + indent[0]
	const prettyAst_ = prettyAst as any as AddParameters<typeof prettyAst, [
		typeof __,
		typeof extra,
	]>
	if (ast instanceof ValidToken) {
		const value = `${ast.value}`
		return `TOKEN ${pos} ${c.values}${quote}${value}${quote}${c.reset}${extra}`
	}
	if (ast instanceof ErrorToken) {
		const value = `[${ast.expected.join(", ")}]`
		return `ERROR ${pos} ${c.error}${value}${c.reset}${extra}`
	}
	if (ast instanceof ConditionNode) {
		const header = `${c.info}${ast.operator === undefined}${c.reset}`
		const not = ast.operator ? prettyAst_(ast.operator, opts, c, ___, `(negation)`) : ""
		const property = ast.property ? prettyAst_(ast.property, opts, c, ___, `(property)`) : ""
		const sepL = ast.sep?.left ? prettyAst_(ast.sep.left, opts, c, ___, `(separator)`) : ""
		const op = ast.propertyOperator ? prettyAst_(ast.propertyOperator, opts, c, ___, `(property operator)`) : ""
		const sepR = ast.sep?.right ? prettyAst_(ast.sep.right, opts, c, ___, `(separator)`) : ""
		const isRegex = ast.value instanceof VariableNode && ast.value.quote?.left.type === TOKEN_TYPE.REGEX
		const isArray = ast.value instanceof ArrayNode
		const variable = prettyAst_(ast.value, opts, c, __L, `(${property ? "value" : "variable/alone"}${isRegex ? " - regex" : isArray ? "- array" : ""})`)
		return [
			`CONDITION ${pos} ${header}${extra}`,
			...toRows([not, property, sepL, op, sepR, variable], opts),
		].join(`\n${__}`)
	}
	if (ast instanceof VariableNode) {
		const prefix = ast.prefix ? prettyAst_(ast.prefix, opts, c, ___, `(value prefix)`) : ""
		const left = ast.quote?.left ? prettyAst_(ast.quote.left, opts, c, ___, "") : ""
		const value = prettyAst_(ast.value, opts, c, !ast.quote ? __L : !ast.quote?.right ? __L : ___, "")
		const right = ast.quote?.right ? prettyAst_(ast.quote.right, opts, c, !ast.quote?.flags ? __L : ___, "") : ""
		const flags = ast.quote?.flags ? prettyAst_(ast.quote.flags, opts, c, __L, "(flags)") : ""

		return [
			`VARIABLE ${pos}${extra}`,
			...toRows([prefix, left, value, right, flags], opts),
		].join(`\n${__}`)
	}
	if (ast instanceof GroupNode) {
		const header = `${c.info}${ast.prefix === undefined || (ast.prefix as ConditionNode).operator === undefined}${c.reset}`
		const prefix = ast.prefix ? prettyAst_(ast.prefix, opts, c, ___, `(group prefix)`) : ""
		const expression = prettyAst_(ast.expression, opts, c, __L, "")
		return [
			`GROUP ${pos}${!extra.includes("value") ? ` ${header}` : ""}${extra}`,
			...toRows([prefix, expression], opts),
		].join(`\n${__}`)
	}
	if (ast instanceof ArrayNode) {
		const bracketL = ast.bracket.left ? prettyAst_(ast.bracket.left, opts, c, ast.values.length === 0 && !ast.bracket.right ? __L : ___, "") : ""
		const values = ast.values.length > 0
			? ast.values.map((node, i) =>
				prettyAst_(node, opts, c, !ast.bracket.right && i === ast.values.length - 1 ? __L : ___, "")
			)
			: []
		const bracketR = ast.bracket.right ? prettyAst_(ast.bracket.right, opts, c, __L, "") : ""
		return [
			`ARRAY ${pos} ${c.info}[${ast.values.length}]${c.reset}${extra}`,
			...toRows([bracketL, ...values, bracketR], opts),
		].join(`\n${__}`)
	}
	if (ast instanceof ExpressionNode) {
		const left = prettyAst_(ast.left, opts, c, ___, "")
		const operator = prettyAst_(ast.operator, opts, c, ___, `(boolean operator)`)
		const right = prettyAst_(ast.right, opts, c, __L, "")

		const header = ast.operator instanceof ErrorToken
			? `${c.info}[${ast.operator.expected.join(",")}]${c.reset}`
			: `${c.info}"${ast.operator.value}"${c.reset}`
		return [
			`EXPRESSION ${pos} ${header}${extra}`,
			...toRows([left, operator, right], opts),
		].join(`\n${__}`)
	}
	unreachable()
}
