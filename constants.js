import fs from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

/**
 * Path to the library.
 * @constant
 */
export const BASE_PATH = dirname(fileURLToPath(import.meta.url))

/**
 * Archive IT base API URL
 */
export const ARCHIVE_IT_API_URL = 'https://partner.archive-it.org'

/**
 * Archive IT base WAYBACK URL
 */
export const ARCHIVE_IT_PLAYBACK_URL = 'https://wayback.archive-it.org'

/**
 * Default value for Preparator.concurrency.
 */
export const DEFAULT_CONCURRENCY = 50

/**
 * Colors used by the logging function
 */
export const LOGGING_COLORS = {
  DEFAULT: chalk.gray,
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
}

/**
 * This project's package.json as a frozen object.
 * @constant
 * @type {object}
 */
export const PACKAGE_INFO = Object.freeze(
  JSON.parse(await fs.readFile(join(BASE_PATH, 'package.json')))
)
