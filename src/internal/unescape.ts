/** @internal */
export function unescape(str: string): string {
	return str.replace(/\\{1,1}(.)/g, "$1")
}
