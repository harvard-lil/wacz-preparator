/// <reference path="./index.types.js" />

import { readFile, rm, mkdir, access, appendFile, readdir } from 'fs/promises'
import { WritableStream } from 'node:stream/web'
import { constants as fsConstants } from 'node:fs'
import { equal, notEqual } from 'node:assert'
import { accessSync, lstatSync, mkdirSync } from 'fs'
import crypto from 'crypto'
import { sep } from 'path'

import { parse as parseHTML } from 'node-html-parser'
import { WACZ } from '@harvard-lil/js-wacz'

import * as CONSTANTS from './constants.js'

/**
 * Downloads all the available WARCs of an Archive It collection and puts them into an indexed WACZ file.
 * Uses crawl and seed information to build pages.jsonl.
 *
 * Usage:
 * ```
 * const capture = new WACZPreparator(username, password, collectionId)
 * await capture.run()
 * ```
 */
export class Preparator {
  /** @type {?string} */
  username = null

  /** @type {?string} */
  password = null

  /** @type {Console} */
  log = console

  /** @type {string} */
  outputPath = process.env.PWD

  /** @type {number} */
  concurrency = 50

  /** @type {?string} */
  signingUrl = null

  /** @type {?string} */
  signingToken = null

  /**
   * @param {PreparatorOptions} options
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
   * Processes "blocking" options, which can't be skipped.
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
   * Processes "non-blocking" options for which we automatically switch to defaults or skip.
   * @param {PreparatorOptions} options
   */
  filterNonBlockingOptions = (options) => {
    const log = this.log

    if (options?.outputPath) {
      try {
        accessSync(options.outputPath)
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
}
