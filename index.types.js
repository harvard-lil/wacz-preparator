/**
 * @typedef {Object} PreparatorOptions
 * Options that can be passed to the `Preparator` class.
 * @property {string} username - Archive It API username.
 * @property {string} password - Archive It API password.
 * @property {number} collectionId - Id of the Archive It collection to prepare.
 * @property {number} [outputPath=null] - Path to output (collection temporary files, final WACZ). Will default to current folder.
 * @property {number} [concurrency=50] - Maximum number of requests that can be run in parallel. Defaults to 50.
 * @property {string} [signingUrl=null] - If set, will be used to try and sign the resulting archive. Must be an authsign-compatible API endpoint (https://github.com/webrecorder/authsign).
 * @property {string} [signingToken=null] - Access token to be used in combination with `signingUrl`.
 * @property {?Console} [log=null] - Will be used instead of the Console API for logging, if compatible (i.e: loglevel). Defaults to globalThis.console.
 */

/**
 * @typedef {Object} ArchiveItWARCReference
 * Reference to a WARC file to be downloaded from Archive-It.
 * @property {?string} downloadUrl - URL that can be used to download the WARC file.
 * @property {?boolean} downloaded - Was this WARC downloaded?
 * @property {?string} filename - WARC filename
 * @property {?string} remoteSHA1Hash - SHA1 hash for that file, as provided by the Archive-It API.
 * @property {?string} localSHA1Hash - SHA1 hash for that file, as computed locally.
 * @property {?number} crawlId - Identifier used to pull crawl and seed information for a given WARC.
 * @property {?ArchiveItCrawledUrl[]} crawledUrls
 */

/**
 * @typedef {Object} ArchiveItCrawledUrl
 * Single entry for WARCReference.crawledUrls.
 * @property {?number} seedId
 * @property {?string} url
 * @property {?string} timestamp
 * @property {?string} title
 */
