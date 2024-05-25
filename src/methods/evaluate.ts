import { get } from "@alanscodelog/utils/get"
import { type AddParameters } from "@alanscodelog/utils/types"
import { unreachable } from "@alanscodelog/utils/unreachable"

import { Condition } from "../ast/classes/Condition.js"
import { Expression } from "../ast/classes/Expression.js"
import type { Parser } from "../Parser.js"
import { TOKEN_TYPE } from "../types/ast.js"


export class EvaluateMixin<T extends {}> {
	/**
	 * Evaluates a {@link Parser.normalize normalized} ast.
	 *
	 * How the ast is evaluated for different operators can be controlled by the {@link ParserOptions.valueComparer valueComparer} option.
	 */
	evaluate(ast: Expression<any, any> | Condition<any, any>, context: Record<string, any>): boolean {
		// @ts-expect-error private method
		this._checkEvaluationOptions()
		const opts = (this as any as Parser<T>).options

		const self_ = this as any as EvaluateMixin<T> & { evaluate: AddParameters<EvaluateMixin<T>["evaluate"], []> }
		if (ast instanceof Condition) {
			const contextValue = get(context, ast.property)
			const res = opts.valueComparer({ property: ast.property, value: ast.value, operator: ast.operator }, contextValue, context)
			return ast.negate ? !res : res
		}
		if (ast instanceof Expression) {
			const left = self_.evaluate(ast.left, context)
			const right = self_.evaluate(ast.right, context)

			return ast.operator === TOKEN_TYPE.AND
				? (left && right)
				: (left || right)
		}

		return unreachable()
	}
}
