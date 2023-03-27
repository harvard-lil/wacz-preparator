import { readFile, rm, mkdir, access, appendFile, readdir } from 'fs/promises'
import { WritableStream } from 'node:stream/web'
import { constants as fsConstants } from 'node:fs'
import { equal, notEqual } from 'node:assert'
import { accessSync, lstatSync } from 'fs'
import crypto from 'crypto'
import { sep } from 'path'

import { parse as parseHTML } from 'node-html-parser'
import { WACZ } from '@harvard-lil/js-wacz'

import * as CONSTANTS from './constants.js'
import { ArchiveItWARCReference, ArchiveItCrawledUrl } from './index.types.js'

/**
 * Downloads all the available WARCs of an Archive It collection and puts them into an indexed WACZ file.
 * Uses crawl and seed information to build pages.jsonl.
 *
 * Usage:
 * ```
 * const collection = new Preparator({username, password, collectionId})
 * await collection.process()
 * ```
 */
export class Preparator {
  /** @type {?string} */
  username = null

  /** @type {?string} */
  password = null

  /** @type {Console} */
  log = console

  /**
   * Folder in which Preparator should work.
   * @type {string}
   */
  outputPath = process.env.PWD

  /**
   * Folder in which the WARCs from Archive It will be stored before being processed.
   * @type {?string}
   */
  collectionPath = null

  /**
   * Path of the resulting .wacz file
   * @type {?string}
   */
  WACZPath = null

  /** @type {?string} */
  collectionTitle = null

  /** @type {?string} */
  collectionDescription = null

  /** @type {number} */
  concurrency = 50

  /** @type {?string} */
  signingUrl = null

  /** @type {?string} */
  signingToken = null

  /**
   * Urls of WARCs to pull from Archive It.
   * @type {ArchiveItWARCReference[]}
   */
  WARCs = []

  /**
   * Used to identify entry points for pages.jsonl
   * @type {WACZPage[]}
   */
  pages = []

  /**
   * @param {object} options
   * @param {string} options.username - Archive It API username.
   * @param {string} options.password - Archive It API password.
   * @param {number} options.collectionId - Id of the Archive It collection to prepare.
   * @param {number} [options.outputPath=null] - Path to output (collection temporary files, final WACZ). Will default to current folder.
   * @param {number} [options.concurrency=50] - Maximum number of requests that can be run in parallel. Defaults to 50.
   * @param {string} [options.signingUrl=null] - If set, will be used to try and sign the resulting archive. Must be an authsign-compatible API endpoint (https://github.com/webrecorder/authsign).
   * @param {string} [options.signingToken=null] - Access token to be used in combination with `signingUrl`.
   * @param {?Console} [options.log=null] - Will be used instead of the Console API for logging, if compatible (i.e: loglevel). Defaults to globalThis.console.
   */
  constructor (options) {
    // We need to process `log` first - as it needs to be used immediately.
    if (options?.log) {
      this.log = options.log

      if (typeof this.log.trace !== 'function' ||
          typeof this.log.info !== 'function' ||
          typeof this.log.warn !== 'function' ||
          typeof this.log.error !== 'function'
      ) {
        throw new Error('"log" must be compatible with the Console API.')
      }
    }

    this.filterBlockingOptions(options)
    this.filterNonBlockingOptions(options)
  }

  /**
   * @returns {Promise<boolean>}
   */
  process = async () => {
    const log = this.log

    // Check credentials
    try {
      log.info('Checking credentials combination')
      await this.checkCredentials()
    } catch (err) {
      log.trace(err)
      log.error('Invalid credentials combination, or the Archive It API could not be reached.')
      return false
    }

    // Does a collection-specific folder exist? (+ auto-create)
    try {
      log.info('Creating collections folder (if not already present)')
      await this.createCollectionFolder()
    } catch (err) {
      log.trace(err)
      log.error('Collections folder could not be accessed or created.')
      return false
    }

    // Grab collection info
    try {
      log.info(`Pulling collection information for ${this.collectionId}`)
      await this.fetchCollectionInfo()
    } catch (err) {
      log.trace(err)
      log.error('An error occurred while pulling collection information.')
      return false
    }

    // List WARCs
    try {
      log.info(`Listing WARC files from collection ${this.collectionId}`)
      await this.fetchWARCsList()
      log.info(`${this.WARCs.length} entries found in total.`)
    } catch (err) {
      log.trace(err)
      log.error('An error occurred while listing WARC files from collection.')
      return false
    }

    // Pull crawl / seed infos
    try {
      log.info('Pulling crawl and seed information for each entry')
      await this.fetchWARCsCrawlInfo()
    } catch (err) {
      log.error('An error occurred while listing WARC files from collection.')
      log.trace(err)
      return false
    }

    // Pull page titles
    try {
      log.info('Pulling page titles for each entry')
      await this.fetchCrawledUrlsTitle()
    } catch (err) { // Non-blocking
      log.trace(err)
      log.error('An error occurred while pulling page titles from the Wayback Machine.')
    }

    // Delete WARCs that may be already present in collection folder,
    // but are not (or no longer) part of the collection.
    try {
      log.info('Deleting "loose" .warc.gz files (present in folder, but not referenced in collection)')
      await this.deleteLooseWARCs()
    } catch (err) {
      log.error('An error occurred while deleting loose WARC files.')
      log.trace(err)
      return false
    }

    // Checksum [1]
    try {
      log.info('Checking hashes of WARCs that may already be present in collection folder')
      await this.checkWARCsHashes()
    } catch (err) {
      log.error(err)
      return false
    }

    // Pull WARCs that aren't already present
    try {
      log.info('Downloading WARCs')
      await this.fetchWARCs()
    } catch (err) {
      log.error(err)
      return false
    }

    // Checksum [2]
    try {
      log.info('Checking hashes on downloaded WARC collection')
      await this.checkWARCsHashes()
    } catch (err) {
      log.error(err)
      return false
    }

    // List pages
    try {
      log.info('Building pages list')
      await this.generatePagesList()
    } catch (err) {
      log.error(err)
      return false
    }

    // Prepare WACZ
    try {
      log.info('Preparing WACZ file')
      await this.generateWACZ()
    } catch (err) {
      log.error('An error occurred while preparing WACZ file.')
      log.trace(err)
      return false
    }

    // Report
    this.printReport()
  }

  /**
   * Filters "blocking" options, which can't be skipped.
   * @param {PreparatorOptions} options
   * @returns {void}
   */
  filterBlockingOptions = (options) => {
    const log = this.log

    try {
      this.username = options.username.trim()
      notEqual(this.username.length, 0)
    } catch (err) {
      log.trace(err)
      throw new Error('"username" must be provided.')
    }

    try {
      this.password = options.password.trim()
      notEqual(this.password.length, 0)
    } catch (err) {
      log.trace(err)
      throw new Error('"password" must be provided.')
    }

    try {
      this.collectionId = Number(options.collectionId)
      equal(isNaN(this.collectionId), false)
      equal(this.collectionId > 0, true)
    } catch (err) {
      log.trace(err)
      throw new Error('"collectionId" must be provided.')
    }
  }

  /**
   * Filters "non-blocking" options for which we automatically switch to defaults or skip.
   * @param {PreparatorOptions} options
   */
  filterNonBlockingOptions = (options) => {
    const log = this.log

    if (options?.outputPath) {
      try {
        accessSync(options.outputPath, fsConstants.W_OK)
        equal(lstatSync(options.outputPath).isDirectory(), true)
        this.outputPath = options.outputPath
      } catch (err) {
        log.trace(err)
        log.warn(`Provided "outputPath" is not a directory or cannot be accessed. Using ${this.outputPath} instead.`)
      }
    }

    if (options?.concurrency) {
      try {
        const concurrency = Number(options.concurrency)
        equal(isNaN(concurrency), false)
        equal(concurrency > 0, true)
        this.concurrency = concurrency
      } catch (err) {
        log.trace(err)
        log.warn(`"concurrency" was not provided or is not a directory. Using ${this.concurrency} instead.`)
      }
    }

    if (options?.signingUrl) {
      try {
        this.signingUrl = new URL(options.signingUrl).href
      } catch (err) {
        log.trace(err)
        log.warn('Provided "signingUrl" is invalid. Skipping.')
      }
    }

    if (this.signingUrl && options?.signingToken) {
      this.signingToken = `${options.signingToken}`
    }
  }

  /**
   * Checks that the credentials that were provided give access to an Archive It collection.
   * Throws if that is not the case.
   * @returns {Promise<void>}
   */
  checkCredentials = async () => {
    const baseUrl = `${CONSTANTS.ARCHIVE_IT_API_URL}/api/collection`
    const params = new URLSearchParams()
    params.append('limit', 1)
    params.append('id', this.collectionId)

    const response = await fetch(`${baseUrl}?${params}`, {
      method: 'HEAD',
      headers: this.getAuthorizationHeader()
    })

    if (response.status !== 200) {
      throw new Error(`Archive-It API responded with ${response.status}`)
    }
  }

  /**
   * Creates collection-specific folder if needed.
   * @returns {Promise<void>}
   */
  createCollectionFolder = async () => {
    this.collectionPath = `${this.outputPath}${sep}${this.collectionId}${sep}`

    let exists = false
    try {
      await access(this.collectionPath, fsConstants.W_OK)
      exists = true
      this.log.info(`Collection folder ${this.collectionPath} already exists.`)
    } catch (err) {
      this.log.info(`Collection folder ${this.collectionPath} needs to be created.`)
    }

    if (!exists) {
      await mkdir(this.collectionPath)
      await access(this.collectionPath, fsConstants.W_OK)
    }
  }

  /**
   * Pulls information about the current collection from the Archive It API.
   * Populates `this.collectionTitle` and `this.collectionDescription`.
   * @returns {Promise<void>}
   */
  fetchCollectionInfo = async () => {
    const baseUrl = `${CONSTANTS.ARCHIVE_IT_API_URL}/api/collection`
    const params = new URLSearchParams()
    params.append('limit', 1)
    params.append('id', this.collectionId)

    const response = await fetch(`${baseUrl}?${params}`, { headers: this.getAuthorizationHeader() })

    if (response.status !== 200) {
      throw new Error(`Archive-It API responded with ${response.status}`)
    }

    const parsed = await response.json()
    const collection = parsed[0]

    if (collection?.metadata?.Title) {
      this.collectionTitle = collection.metadata.Title[0].value
    }

    if (collection?.metadata?.Description) {
      this.collectionDescription = collection.metadata.Description[0].value
    }
  }

  /**
   * Pulls a list of all the WARC files of the current collection.
   * Populates `this.WARCs`.
   * @returns {Promise<void>}
   */
  fetchWARCsList = async () => {
    const baseUrl = `${CONSTANTS.ARCHIVE_IT_API_URL}/wasapi/v1/webdata`
    const params = new URLSearchParams()
    params.append('page', 1)
    params.append('page_size', 500)
    params.append('collection', this.collectionId)

    while (true) {
      const response = await fetch(`${baseUrl}?${params}`, { headers: this.getAuthorizationHeader() })

      if (response.status !== 200) {
        throw new Error(`Archive-It API responded with ${response.status}`)
      }

      const parsed = await response.json()

      for (const entry of parsed.files) {
        const ref = new ArchiveItWARCReference()
        ref.downloadUrl = entry?.locations ? entry.locations[0] : null
        ref.filename = entry?.filename
        ref.remoteSHA1Hash = entry?.checksums?.sha1
        ref.crawlId = entry?.crawl
        this.WARCs.push(ref)
      }

      // Is there a "next" results page?
      if (parsed.next) {
        params.set('page', parseInt(params.get('page')) + 1)
      } else {
        break
      }
    }
  }

  /**
   * Fetches crawl / seed information for each entry in `this.WARCs`.
   * Uses `this.WARCs`, populates `this.WARCs[].crawledUrls`.
   * Runs up to `this.concurrency` requests in parallel.
   *
   * @throws
   * @returns {Promise<void>}
   */
  fetchWARCsCrawlInfo = async () => {
    const { log, concurrency } = this
    const group = []

    /**
     * @param {ArchiveItWARCReference} ref
     * @returns {Promise<void>}
     */
    const fetchOne = async (ref) => {
      log.info(`${ref.filename}: pulling crawl info.`)

      const response = await fetch(
        `${CONSTANTS.ARCHIVE_IT_API_URL}/api/reports/seed/${ref.crawlId}`,
        { headers: this.getAuthorizationHeader() }
      )

      if (response.status !== 200) {
        throw new Error(`Archive-It API responded with ${response.status} for crawl ID ${ref.crawlId}.`)
      }

      const parsed = await response.json()

      for (const seed of parsed) {
        const crawledUrl = new ArchiveItCrawledUrl()
        crawledUrl.seedId = seed?.seed_id
        crawledUrl.url = seed?.seed
        crawledUrl.timestamp = seed?.timestamp

        ref.crawledUrls.push(crawledUrl)
      }
    }

    for (let i = 0; i < this.WARCs.length; i++) {
      // Make groups of X files for which we need crawl info.
      if (group.length < concurrency) {
        group.push(this.WARCs[i])
      }

      // Pull crawl info in parallel for X files.
      if (group.length >= concurrency || i === this.WARCs.length - 1) {
        const results = await Promise.allSettled(group.map(ref => fetchOne(ref)))

        for (const result of results) {
          if (result.status === 'rejected') {
            log.trace(result.reason)
            log.warn('A request to pull crawl info failed. Skipping.')
          }
        }

        group.length = 0
      }
    }
  }

  /**
   * Fetches page titles for all entries in `this.WARCs[].crawledUrls`.
   * Will first try to grab that information from Archive-It's meta data if available.
   * Will attempt to scrape the Wayback Machine for that information otherwise.
   *
   * Uses `this.WARCs`.
   * Runs up to `this.concurrency` requests in parallel.
   *
   * @throws
   * @returns {Promise<void>}
   */
  fetchCrawledUrlsTitle = async () => {
    const { log, concurrency } = this
    const group = []

    /**
     * Tries to pull the page title of a given CrawledUrl object.
     * @param {ArchiveItCrawledUrl} crawl
     */
    const fetchOne = async (crawl) => {
      /** @type {?string} */
      let title = null

      // First attempt: fetch from meta data
      if (crawl.seedId) {
        try {
          const response = await fetch(`${CONSTANTS.ARCHIVE_IT_API_URL}/api/seed/${crawl.seedId}`)
          const parsed = await response.json()

          if (parsed?.metadata && parsed.metadata?.Title && parsed.metadata.Title.length > 0) {
            title = parsed.metadata.Title[0].value
          }
        } catch (err) {
          log.info(`An error occurred while trying to pull seed information for ${crawl.seedId}.`)
          log.trace(err)
        }
      }

      // Second attempt: fetch from the Wayback Machine
      if (!title) {
        let waybackUrl = CONSTANTS.ARCHIVE_IT_PLAYBACK_URL
        waybackUrl += `/${this.collectionId}`
        waybackUrl += `/${crawl.timestamp.substring(0, 19).replaceAll(/[ \-:]/g, '')}` // 2019-09-18 22:11:28.058000 -> 20190918221128
        waybackUrl += `/${encodeURIComponent(crawl.url)}`

        try {
          const response = await fetch(waybackUrl)

          if (response.status === 200 && response.headers.get('content-type').startsWith('text/html')) {
            const html = parseHTML(await response.text())
            title = title === 'Archive-it Wayback' ? null : html.querySelector('title').textContent
          }
        } catch (err) {
          log.info(`An error occurred while trying to retrieve the archived page title from ${waybackUrl}.`)
          log.trace(err)
        }
      }

      if (title) {
        log.info(`Title found for ${crawl.url}: ${title}`)
        crawl.title = title
      } else {
        this.log.warn(`No title found for ${crawl.url}.`)
      }
    }

    // Make groups of X CrawledUrls objects for which we need to pull page title.
    for (let i = 0; i < this.WARCs.length; i++) {
      const ref = this.WARCs[i]

      // Skip if this is a `MISSING_URLS_PATCH` batch
      if (ref.filename.includes('MISSING_URLS_PATCH')) {
        continue
      }

      for (let ii = 0; ii < ref.crawledUrls.length; ii++) {
        if (group.length < concurrency) {
          group.push(ref.crawledUrls[ii])
        }

        if (group.length >= concurrency) {
          break
        }
      }

      // Pull page titles in parallel for up to X entries
      if (group.length >= concurrency || i >= this.WARCs.length) {
        const results = await Promise.allSettled(group.map(crawl => fetchOne(crawl)))

        for (const result of results) {
          if (result.status === 'rejected') {
            log.trace(result.reason)
          }
        }

        group.length = 0
      }
    }
  }

  /**
   * Removes WARC files from collection directory that are not referenced in the collection.
   * This comparison is based on filenames.
   * @returns {Promise<void>}
   */
  deleteLooseWARCs = async () => {
    const log = this.log
    const inCollection = {}

    for (const entry of this.WARCs) {
      inCollection[entry.filename] = true
    }

    for (const filename of await readdir(this.collectionPath)) {
      if (filename.endsWith('.warc.gz') && filename in inCollection) {
        continue
      }

      log.info(`${filename}: present on disk but not in collection, will be deleted.`)
      await rm(`${this.collectionPath}${filename}`)
    }
  }

  /**
   * For each entry in `this.WARCs`:
   * - Check if file exists locally and check local SHA-1 hash against remote reference
   * - Mark WARC as "downloaded" true / false based on results.
   * - Will delete local files that have a hash mismatch.
   * @returns {Promise<void>}
   */
  checkWARCsHashes = async () => {
    for (const entry of this.WARCs) {
      const log = this.log
      const filepath = `${this.collectionPath}${entry.filename}`
      entry.downloaded = true

      try {
        await access(filepath)
      } catch (_err) {
        entry.downloaded = false
        continue
      }

      try {
        log.info(`${entry.filename}: present on disk, checking hash.`)
        entry.localSHA1Hash = crypto.createHash('sha1').update(await readFile(filepath)).digest('hex')
      } catch (err) {
        log.trace(err)
        log.error(`${entry.filename}: error occurred while calculating SHA-1 hash.`)
        entry.downloaded = false
      }

      if (entry.localSHA1Hash && entry.localSHA1Hash !== entry.remoteSHA1Hash) {
        log.error(`${entry.filename}: remote and local SHA-1 hash mismatch. Deleting local copy.`)
        await rm(filepath)
        entry.downloaded = false
      }
    }
  }

  /**
   * Downloads files from `this.WARCs` in parallel.
   * Streams to disk. Downloads up to `this.concurrency` WARCs in parallel.
   * @returns {Promise<void>}
   */
  fetchWARCs = async () => {
    const { log, concurrency } = this
    const group = []

    /**
     * Pulls a WARC and streams it to disk.
     * @param {WARCReference} ref
     * @returns {Promise<void>}
     */
    const fetchOne = async (ref) => {
      log.info(`${ref.filename}: downloading ...`)
      const filepath = `${this.collectionPath}${ref.filename}`
      const response = await fetch(ref.downloadUrl, { headers: this.getAuthorizationHeader() })

      if (response.status !== 200) {
        throw new Error(`Archive-It API responded with ${response.status} for ${ref.downloadUrl}.`)
      }

      try {
        const dest = new WritableStream({
          async write (chunk) {
            await appendFile(filepath, chunk)
          }
        })
        await response.body.pipeTo(dest)
      } catch (err) {
        throw new Error(`Failed to write ${ref.filename} to disk.\n${err}`)
      }
    }

    for (let i = 0; i < this.WARCs.length; i++) {
      const ref = this.WARCs[i]

      // Make groups of X files that need to be downloaded
      if (group.length < concurrency) {
        if (ref.downloaded === false) {
          group.push(ref)
        }
      }

      // Pull files in parallel
      if (group.length >= concurrency || i === this.WARCs.length - 1) {
        const results = await Promise.allSettled(group.map(ref => fetchOne(ref)))

        for (const result of results) {
          if (result.status === 'rejected') {
            log.trace(result.reason)
          }
        }

        group.length = 0
      }
    }
  }

  /**
   * Generates a pages list (entry points) to be used to generate by pages.jsonl.
   * Skips WARCS that were marked as `MISSING_URLS_PATCH`.
   * Updates `this.pages`.
   *
   * See: https://specs.webrecorder.net/wacz/1.1.1/#pages-jsonl
   * @returns {Promise<void>}
   */
  generatePagesList = async () => {
    this.pages = []

    /**
     * @param {string} timestamp - From Archive-It /api/reports/seed/ entry
     * @returns {string}
     */
    const formatTimestamp = (timestamp) => {
      try {
        // Timestamps from crawl info are ill-formatted (ex: 2021-04-30 20:04:57.635000)
        timestamp = timestamp.replace(' ', 'T')
        timestamp += 'Z'
        return new Date(timestamp).toISOString().split('.')[0] + 'Z'
      } catch {
        return null
      }
    }

    for (const entry of this.WARCs) {
      // Skip if this is a `MISSING_URLS_PATCH` batch
      if (entry.filename.includes('MISSING_URLS_PATCH')) {
        continue
      }

      // Skip if there are not crawledUrls entries
      if (!entry.crawledUrls) {
        continue
      }

      for (const crawl of entry.crawledUrls) {
        // Skip if entry doesn't have a title
        if (!crawl.title) {
          continue
        }

        this.pages.push({
          url: crawl.url,
          title: crawl.title,
          ts: formatTimestamp(crawl.timestamp)
        })
      }
    }
  }

  /**
   * Calls py-wacz to generate a WACZ out of the .warc.gz files that were downloaded.
   * @throws
   * @returns {Promise<void>}
   */
  generateWACZ = async () => {
    this.WACZPath = `${this.outputPath}${sep}${this.collectionId}.wacz`

    const archive = new WACZ({
      input: `${this.collectionPath}*.warc.gz`,
      output: this.WACZPath,
      log: this.log,
      title: this.collectionTitle,
      description: this.collectionDescription
    })

    // Add pages
    for (const page of this.pages) {
      archive.addPage(page.url, page.title, page.ts)
    }

    // Process archive
    await archive.process()

    // Check that file is there
    await access(this.WACZPath)
  }

  /**
   * Prints processing report.
   * @returns {void}
   */
  printReport = () => {
    const log = this.log

    log.info('📚 Collection is ready.')

    // How many files could not be downloaded?
    let notDownloaded = 0

    for (const entry of this.WARCs) {
      if (entry.downloaded === false) {
        notDownloaded += 1
      }
    }

    if (notDownloaded) {
      log.warn(`${this.notDownloaded} of ${this.WARCs.length} WARC files have not been downloaded.`)
    }

    log.info(`WACZ file can be found here: ${this.WACZPath}`)
  }

  /**
   * Deletes the collection folder and its contents.
   * @returns {Promise<void>}
   */
  clear = async () => {
    if (this.collectionPath) {
      await rm(this.collectionPath, { force: true, recursive: true })
    }
  }

  /**
   * @return {{Authorization: string}}
   */
  getAuthorizationHeader = () => {
    const payload = Buffer.from(this.username + ':' + this.password).toString('base64')
    return { Authorization: `Basic ${payload}` }
  }
}
