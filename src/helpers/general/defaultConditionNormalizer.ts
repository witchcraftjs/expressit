import type { ConditionNormalizer, ValueQuery } from "../../types/parser.js"


export const defaultConditionNormalizer: ConditionNormalizer =
function defaultConditionNormalizer(
	{ value, operator, isNegated }: Pick<ValueQuery, "value" | "operator" | "isNegated">,
) {
	return { value, operator, negate: isNegated }
}
