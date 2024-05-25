import { type AddParameters } from "@alanscodelog/utils/types"
import { unreachable } from "@alanscodelog/utils/unreachable"

import { ArrayNode } from "../ast/classes/ArrayNode.js"
import { Condition } from "../ast/classes/Condition.js"
import { ConditionNode } from "../ast/classes/ConditionNode.js"
import { ErrorToken } from "../ast/classes/ErrorToken.js"
import { Expression } from "../ast/classes/Expression.js"
import { ExpressionNode } from "../ast/classes/ExpressionNode.js"
import { GroupNode } from "../ast/classes/GroupNode.js"
import { ValidToken } from "../ast/classes/ValidToken.js"
import { VariableNode } from "../ast/classes/VariableNode.js"
import { applyBoolean } from "../helpers/general/applyBoolean.js"
import { applyPrefix } from "../helpers/general/applyPrefix.js"
import type { Parser } from "../Parser.js"
import { type ParserResults, TOKEN_TYPE, type TokenBooleanTypes } from "../types/ast.js"
import type { ValueQuery } from "../types/parser.js"


const OPPOSITE = {
	[TOKEN_TYPE.AND]: TOKEN_TYPE.OR,
	[TOKEN_TYPE.OR]: TOKEN_TYPE.AND,
}

export class NormalizeMixin<T extends {}> {
	/**
	 * Normalizes the ast by applying {@link GroupNode GroupNodes} and converting {@link ConditionNode ConditionNodes} to {@link NormalizedConditionNode NormalizedConditionNodes}.
	 */
	normalize<TType extends string, TValue>(ast: ParserResults): Condition<TType, TValue> | Expression<TType, TValue> {
		// @ts-expect-error private method
		this._checkEvaluationOptions()
		const opts = (this as any as Parser<T>).options
		if (ast instanceof ErrorToken || !ast.valid) {
			throw new Error("AST node must be valid.")
		}
		// eslint-disable-next-line prefer-rest-params
		const prefix: string | undefined = arguments[1]
		// eslint-disable-next-line prefer-rest-params
		const groupValue: boolean | undefined = arguments[2]
		// eslint-disable-next-line prefer-rest-params
		let operator: string | undefined = arguments[3]

		const self_ = this as any as NormalizeMixin<T> & { normalize: AddParameters<NormalizeMixin<T>["normalize"], [typeof prefix, typeof groupValue, typeof operator]> }

		if (ast instanceof ConditionNode) {
			if (!(ast.value instanceof GroupNode)) {
				const isValue = ast.value instanceof ArrayNode || (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				let name = ast.property
					? unescape(ast.property.value.value)
					: isValue
						// the property might be missing, whether this is valid or not is up to the user
						// e.g. if prefix is defined this would make some sense
						? undefined
						: unescape((ast.value as VariableNode)?.value.value)
				// some ancestor node went through the else block because it was a group node (e.g. prop:op(val))
				// so the "prefix" we passed is actually the name of the property (e.g. prop) and the value is the name we're getting here (e.g. val)
				const isNested = operator !== undefined
				if (prefix !== undefined && !isNested) {
					name = name ? applyPrefix(prefix, name, opts.prefixApplier) : prefix
				}
				let value: any
				if (isNested) {
					value = name ?? true
					name = prefix
				} else {
					value = ast.value instanceof ArrayNode
						? ast.value.values.map(val => unescape(val.value.value))
						: (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
							? ast.value.value.value
							: ast.property && ast.value instanceof VariableNode
								? unescape(ast.value.value.value)
								: true
				}
				const propertyKeys = name ? opts.keyParser(name) : []

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				const valuePrefix = ast.value instanceof VariableNode && ast.value.prefix
					? unescape(ast.value.prefix.value)
					: undefined
				// one or the other might be defined, but never both since nested properties (e.g. `prop:op(prop:op(...))`) are not allowed
				operator ??= ast.propertyOperator?.value
				const isRegex = (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const isQuoted = (ast.value as VariableNode)?.quote !== undefined
				const isExpanded = ast.sep !== undefined
				const regexFlags = (ast.value as VariableNode)?.quote?.flags?.value
				const query: ValueQuery = {
					value,
					operator,
					prefix: valuePrefix,
					regexFlags,
					property: propertyKeys,
					isRegex,
					isQuoted,
					isExpanded,
					isNegated: !boolValue,
					condition: ast,
				}
				const res = opts.conditionNormalizer(query)
				return new Condition({ property: propertyKeys, ...res })
			} else {
				let name = unescape((ast.property as VariableNode).value.value) // this is always a variable node
				if (prefix !== undefined) {
					name = applyPrefix(prefix, name, opts.prefixApplier)
				}
				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				// other operator is never defined see comments in other block above
				// eslint-disable-next-line @typescript-eslint/no-shadow
				const operator = ast.propertyOperator?.value
				// this call will at some point lead us to the above block with isNested = true
				return self_.normalize(ast.value, name, boolValue, operator) as any
			}
		}

		if (ast instanceof GroupNode) {
			const _prefix = ast.prefix instanceof ConditionNode && ast.prefix.value instanceof VariableNode
				? unescape(ast.prefix.value.value.value)
				: undefined // we do not want to apply not tokens
			const _groupValue = ast.prefix instanceof ConditionNode
				? ast.prefix.operator === undefined
				: !(ast.prefix instanceof ValidToken)

			const applied = applyPrefix(prefix, _prefix ?? "", opts.prefixApplier)

			return self_.normalize(ast.expression as any, applied, applyBoolean(groupValue, _groupValue), operator) as any
		}
		if (ast instanceof ExpressionNode) {
			const left = self_.normalize(ast.left, prefix, groupValue, operator)
			const right = self_.normalize(ast.right, prefix, groupValue, operator)

			// apply De Morgan's laws if group prefix was negative
			// the values are already flipped, we just have to flip the operator
			const type: TokenBooleanTypes = (groupValue === false ? OPPOSITE[ast.operator.type] : ast.operator.type) as TokenBooleanTypes
			return new Expression<TType, TValue>({ operator: type, left: left as any, right: right as any })
		}
		return unreachable()
	}
}
