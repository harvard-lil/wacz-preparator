/**
 * Reference to a WARC file to be downloaded from Archive-It.
 */
export class ArchiveItWARCReference {
  /**
   * URL that can be used to download the WARC file.
   * @type {boolean}
   */
  downloadUrl = null

  /**
   * Was this WARC downloaded?
   * @type {boolean}
   */
  downloaded = false

  /**
   * WARC filename.
   * @type {?string}
   */
  filename = null

  /**
   * SHA1 hash for that file, as provided by the Archive-It API.
   * @type {?string}
   */
  remoteSHA1Hash = null

  /**
   * SHA1 hash for that file, as computed locally.
   * @type {?string}
   */
  localSHA1Hash = null

  /**
   * Identifier used to pull crawl and seed information for a given WARC.
   * @type {?number}
   */
  crawlId = null

  /** @type {ArchiveItCrawledUrl[]} */
  crawledUrls = []
}

/**
 * Single entry for WARCReference.crawledUrls.
 */
export class ArchiveItCrawledUrl {
  /** @type {?number} */
  seedId = null

  /** @type {?string} */
  url = null

  /** @type {?string} */
  timestamp = null

  /** @type {?string} */
  title = null
}
