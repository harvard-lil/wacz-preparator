/**
 * @typedef {Object} PreparatorOptions
 * @property {string} username - Archive It API username.
 * @property {string} password - Archive It API password.
 * @property {number} collectionId - Id of the Archive It collection to prepare.
 * @property {number} [outputPath=null] - Path to output (collection temporary files, final WACZ). Will default to current folder.
 * @property {number} [concurrency=50] - Maximum number of requests that can be run in parallel. Defaults to 50.
 * @property {string} [signingUrl=null] - If set, will be used to try and sign the resulting archive. Must be an authsign-compatible API endpoint (https://github.com/webrecorder/authsign).
 * @property {string} [signingToken=null] - Access token to be used in combination with `signingUrl`.
 * @property {?Console} [log=null] - Will be used instead of the Console API for logging, if compatible (i.e: loglevel). Defaults to globalThis.console.
 */
