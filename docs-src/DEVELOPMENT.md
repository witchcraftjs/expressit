---
title: Development
group: Guides
---
## File Structure

This library makes use of a custom index file manager I wrote, called [indexit](https://github.com/alanscodelog/indexit).

Whenever a file is added/removed, the `gen:exports` script should be called, it calls indexit with the right options and will update the necessary index files.

Every function normally has it's own file and there should only be one export per file (indexit does not support multiple yet, and will just use the first export).

The only exception is the handlers for the parser rules. These are internal, short, easier to maintain in one file, and used like `import * as handle`.

```text
src
 ┣ ast
 ┃ ┣ builders - used to quickly build ast classes for testing
 ┃ ┃ - instances returned are unsealed, i.e. their parents are not assigned
 ┃ ┣ classes - the actual ast node classes
 ┃ ┣ handlers.ts - used inside grammar/ParserBase.ts to handle the creation of tokens / ast node classes
 ┣ examples - contains fully implemented parser examples
 ┣ helpers
 ┃ ┣ general - ...various internal helper functions not related to parsing + default functions for the default parser options
 ┃ ┣ parser - ...various internal helper functions used before/during parsing
 ┃ ┗ errors.ts - the main error handling class (error types are defined in types/errors)
 ┣ methods - all the main methods of the main parser class
 ┣ types - all the types and enums are stored here in their respective categories
 ┣ utils - exported utility functions
 ┣ global.d.ts - additional global types
 ┣ package.js - see file for explanation
 ┗ parser.ts - the root / main export of the project. all it's longer methods are in the ./methods folder
tests
 ┣ template.ts - the template to use for tests, just copy and rename to the name of the test + `.spec.ts`
 ┗ utils.ts - contains even shorter (one letter) versions of the ast/builders for the most common uses
```

