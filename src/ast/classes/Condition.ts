export class Condition<TOp extends string = string, TValue = any> {
	readonly value: TValue

	readonly operator?: TOp

	readonly property: string[]

	readonly negate: boolean

	constructor({ property, operator, value, negate }: {
		property: Condition<TOp, TValue>["property"]
		operator: Condition<TOp, TValue>["operator"]
		value: Condition<TOp, TValue>["value"]
		negate: Condition<TOp, TValue>["negate"]
	}) {
		this.value = value
		this.operator = operator
		this.property = property
		this.negate = negate
	}
}

