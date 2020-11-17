// eslint-disable-next-line no-restricted-imports
import pkg from "../package.json"

/**
 * This library imports it's own package.json for inserting the version number into errors. Doing this is not a problem normally (because babel is used to transpile the typescript instead of tsc), but when tsc is used to output the types, the output is nested (dist-types/src/*) because of the json import being outside the src dir. There is a way around this but it's complicated. The easier way is to just cheat and do the importing in this js file. Typescript consumes it none the wiser and babel transpiles it to cjs/es accordingly.
 *
 * The values could be inlined, but there are no battle tested actively maintained babel plugins for this, and problems would be hard to debug (given when developing, the package.json never contains the real version because the library is semantically released.)
 */


export const version = pkg.version
export const repository = pkg.repository
