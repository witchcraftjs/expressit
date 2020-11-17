import type { ConditionNormalizer } from "@/types"


export const defaultConditionNormalizer: ConditionNormalizer =
function defaultConditionNormalizer({ value, operator, isNegated }) {
	return { value, operator, negate: isNegated }
}
