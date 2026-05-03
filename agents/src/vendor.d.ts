// @0glabs/0g-serving-broker ships types at lib.esm/index.d.ts but its package.json
// "exports" field has no "types" condition, so bundler moduleResolution can't find them.
declare module '@0glabs/0g-serving-broker'
