/** @internal */
export function applyBoolean(left: boolean | undefined, right: boolean): boolean {
	if (left === undefined) {return right}
	if (!left) {
		if (!right) {return true} else {return left}
	} else {
		return right
	}
}
