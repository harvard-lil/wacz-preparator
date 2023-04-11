import { rm, access } from 'fs/promises'
import { accessSync, lstatSync } from 'fs'
import { constants as fsConstants } from 'node:fs'
import { equal } from 'node:assert'
import { sep } from 'path'

import { WACZ } from '@harvard-lil/js-wacz'

import * as CONSTANTS from './constants.js'

/**
 * Base class for all wacz-preparator extractors.
 * Inheriting class _must_ implement:
 * - `async process()`
 * - `printReport()`
 *
 * Example: ArchiveItExtractor.
 */
export class BaseExtractor {
  /** @type {Console} */
  log = console

  /**
   * Path of the resulting .wacz file
   * @type {?string}
   */
  WACZPath = null

  /** @type {?string} */
  collectionTitle = null

  /** @type {?string} */
  collectionDescription = null

  /**
   * Folder in which wacz-preparator should operate.
   * @type {string}
   */
  outputPath = process.env.PWD

  /**
   * Folder in which the WARCs will be stored before being processed.
   * @type {?string}
   */
  collectionPath = null

  /** @type {number} */
  concurrency = CONSTANTS.DEFAULT_CONCURRENCY

  /** @type {?string} */
  signingUrl = null

  /** @type {?string} */
  signingToken = null

  /**
   * Used to identify entry points for pages.jsonl
   * @type {WACZPage[]}
   */
  pages = []

  /**
   * @param {number} [options.outputPath=null] - Path to output (collection temporary files, final WACZ). Will default to current folder.
   * @param {number} [options.concurrency=50] - Maximum number of requests that can be run in parallel. Defaults to 50.
   * @param {string} [options.signingUrl=null] - If set, will be used to try and sign the resulting archive. Must be an authsign-compatible API endpoint (https://github.com/webrecorder/authsign).
   * @param {string} [options.signingToken=null] - Access token to be used in combination with `signingUrl`.
   * @param {?Console} [options.log=null] - Will be used instead of the Console API for logging, if compatible (i.e: loglevel). Defaults to globalThis.console.
   */
  constructor (options) {
    if (options?.log) {
      this.log = options.log

      if (typeof this.log.trace !== 'function' ||
          typeof this.log.info !== 'function' ||
          typeof this.log.warn !== 'function' ||
          typeof this.log.error !== 'function'
      ) {
        throw new Error('"log" must be compatible with the Console API')
      }
    }

    if (options?.outputPath) {
      try {
        accessSync(options.outputPath, fsConstants.W_OK)
        equal(lstatSync(options.outputPath).isDirectory(), true)
        this.outputPath = options.outputPath
      } catch (err) {
        this.log.trace(err)
        this.log.warn(`Provided "outputPath" is not a directory or cannot be accessed. Using ${this.outputPath} instead`)
      }
    }

    if (options?.concurrency) {
      try {
        const concurrency = Number(options.concurrency)
        equal(isNaN(concurrency), false)
        equal(concurrency > 0, true)
        this.concurrency = concurrency
      } catch (err) {
        this.log.trace(err)
        this.log.warn(`"concurrency" was not provided or is not a directory. Using ${this.concurrency} instead`)
      }
    }

    if (options?.signingUrl) {
      try {
        this.signingUrl = new URL(options.signingUrl).href
      } catch (err) {
        this.log.trace(err)
        this.log.warn('Provided "signingUrl" is invalid -- skipping')
      }
    }

    if (this.signingUrl && options?.signingToken) {
      this.signingToken = `${options.signingToken}`
    }
  }

  /**
   * Calls js-wacz to generate a WACZ out of the .warc / .warc.gz files that were downloaded.
   * Note: Sets `this.WACZPath` to "archive.wacz" if not set.
   * @throws
   * @param {string} [inputFormat="warc.gz"]
   * @returns {Promise<void>}
   */
  generateWACZ = async (inputFormat = 'warc.gz') => {
    if (['warc', 'warc.gz'].includes(inputFormat) === false) {
      throw new Error('"inputFormat" must be either ".warc" or ".warc.gz".')
    }

    if (!this.WACZPath) {
      this.WACZPath = `${this.outputPath}${sep}archive.wacz`
    }

    const archive = new WACZ({
      input: `${this.collectionPath}*.${inputFormat}`,
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
   * Need method needs to be implemented by inheriting classes.
   */
  process = async () => {
    throw new Error('Not implemented.')
  }

  /**
   * Need method needs to be implemented by inheriting classes.
   */
  printReport = () => {
    throw new Error('Not implemented.')
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
}
