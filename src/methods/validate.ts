import { type AddParameters, get, isArray } from "@alanscodelog/utils"

import { ArrayNode } from "../ast/classes/ArrayNode.js"
import { ConditionNode } from "../ast/classes/ConditionNode.js"
import { ErrorToken } from "../ast/classes/ErrorToken.js"
import { ExpressionNode } from "../ast/classes/ExpressionNode.js"
import { GroupNode } from "../ast/classes/GroupNode.js"
import { ValidToken } from "../ast/classes/ValidToken.js"
import { VariableNode } from "../ast/classes/VariableNode.js"
import { applyBoolean } from "../helpers/general/applyBoolean.js"
import { applyPrefix } from "../helpers/general/applyPrefix.js"
import type { Parser } from "../parser.js"
import { type ParserResults, type Position, TOKEN_TYPE } from "../types/ast.js"
import type { ValidationQuery } from "../types/parser.js"


export class ValidateMixin<T extends {}> {
	/**
	 * Allows pre-validating ASTs for syntax highlighting purposes.
	 * Works similar to evaluate. Internally it will use the prefixApplier, keyParser, and valueValidator (instead of comparer).
	 *
	 * The context does not need to be passed. If it's not passed, the function will not attempt to get the values (so it will not error) and the contextValue param of the valueValidator will be undefined.
	 */
	validate(ast: ParserResults, context?: Record<string, any>): (Position & T)[] {
		const self = (this as any as Parser<T>)
		self._checkValidationOptions()
		const opts = self.options
		// see evaluate function, this method is practically identical, except we don't keep track of the real value (since we are not evaluating) and the actual nodes/tokens are passed to the valueValidator, not just the string values.
		if (ast instanceof ErrorToken || !ast.valid) {
			throw new Error("AST node must be valid.")
		}
		/** Handle hidden recursive version of the function. */
		// eslint-disable-next-line prefer-rest-params
		const prefix: string | undefined = arguments[2]
		// eslint-disable-next-line prefer-rest-params
		const groupValue: boolean | undefined = arguments[3]
		// eslint-disable-next-line prefer-rest-params
		const results: (Position & T)[] = arguments[4] ?? []
		// eslint-disable-next-line prefer-rest-params
		const prefixes: VariableNode[] = arguments[5] ?? []
		// eslint-disable-next-line prefer-rest-params
		let operator: ValidToken<TOKEN_TYPE.VALUE | TOKEN_TYPE.OP_CUSTOM> | undefined = arguments[6]

		const self_ = this as any as ValidateMixin<T> & { validate: AddParameters<ValidateMixin<T>["validate"], [typeof prefix, typeof groupValue, typeof results, typeof prefixes, typeof operator]> }

		if (ast instanceof ConditionNode) {
			if (!(ast.value instanceof GroupNode)) {
				const isValue = ast.value instanceof ArrayNode || (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const nameNode = ast.property
					? ast.property as VariableNode
					: isValue
					? undefined
					: ast.value as VariableNode

				let name = nameNode ? unescape(nameNode.value.value) : undefined
				const isNested = operator !== undefined
				if (prefix !== undefined && !isNested) {
					name = name ? applyPrefix(prefix, name, opts.prefixApplier) : prefix
				}
				let value: any
				let propertyNodes: VariableNode[] = []

				if (isNested) {
					value = name
					name = prefix
					propertyNodes = [...prefixes]
				} else {
					propertyNodes = [...prefixes, ...(nameNode ? [nameNode] : [])]
					value = ast.value instanceof ArrayNode
						? ast.value.values
						: (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
						? ast.value
						: ast.property && ast.value instanceof VariableNode
						? ast.value
						: true
				}
				const propertyKeys = name ? opts.keyParser(name) : []
				const contextValue = context !== undefined ? get(context, propertyKeys) : undefined

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				const valuePrefix = ast.value instanceof VariableNode && ast.value.prefix
					? ast.value.prefix
					: undefined
				operator ??= ast.propertyOperator as ValidToken<TOKEN_TYPE.VALUE | TOKEN_TYPE.OP_CUSTOM>
				const isRegex = (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const isQuoted = (ast.value as VariableNode)?.quote !== undefined
				const isExpanded = ast.sep !== undefined
				const regexFlags = (ast.value as VariableNode)?.quote?.flags
				const query: ValidationQuery = {
					value,
					operator,
					prefix: valuePrefix,
					prefixes,
					property: propertyNodes,
					propertyKeys,
					propertyName: name,
					regexFlags,
					isRegex,
					isNegated: !boolValue,
					isQuoted,
					isExpanded,
					condition: ast,
				}
				const res = opts.valueValidator(contextValue, query, context)
				if (res && !isArray(res)) throw new Error("The valueValidator must return an array or nothing/undefined")
				if (res) { for (const entry of res) results.push(entry) }
			} else {
				let name = unescape((ast.property as VariableNode).value.value) // this is always a variable node
				if (prefix !== undefined) {
					name = applyPrefix(prefix, name, opts.prefixApplier)
				}

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)

				if (ast.property) prefixes.push((ast.property as any))
				// eslint-disable-next-line @typescript-eslint/no-shadow
				const operator = ast.propertyOperator as ValidToken<TOKEN_TYPE.VALUE | TOKEN_TYPE.OP_CUSTOM>
				self_.validate(ast.value, context, name, boolValue, results, prefixes, operator)
			}
		}

		if (ast instanceof GroupNode) {
			const _prefix = ast.prefix instanceof ConditionNode && ast.prefix.value instanceof VariableNode
				? ast.prefix.value
				: undefined // we do not want to apply not tokens
			if (_prefix) prefixes.push(_prefix)

			const _groupValue = ast.prefix instanceof ConditionNode
				? ast.prefix.operator === undefined
				: !(ast.prefix instanceof ValidToken)

			self_.validate(ast.expression as any, context, applyPrefix(prefix, _prefix?.value.value ?? "", opts.prefixApplier), applyBoolean(groupValue, _groupValue), results, prefixes, operator)
		}
		if (ast instanceof ExpressionNode) {
			// prefixes must be spread because we don't want the left branch (if it goes deeper) to affect the right
			self_.validate(ast.left, context, prefix, groupValue, results, [...prefixes], operator)
			self_.validate(ast.right, context, prefix, groupValue, results, [...prefixes], operator)
		}
		return results
	}
}
