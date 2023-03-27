#! /usr/bin/env node

import { equal as assert } from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'

import { Command, Option } from 'commander'
import log from 'loglevel'
import logPrefix from 'loglevel-plugin-prefix'

import { Preparator } from '../index.js'
import { PACKAGE_INFO, LOGGING_COLORS } from '../constants.js'

/** @type {Command} */
const program = new Command()

//
// Program info
//
program
  .name(PACKAGE_INFO.name)
  .description(`${PACKAGE_INFO.description}\nMore info: https://github.com/harvard-lil/wacz-preparator`)
  .version(PACKAGE_INFO.version, '-v, --version', 'Display Library and CLI version.')
  .helpOption(null, 'Show options list.')

//
// Options
//
program.requiredOption('-u, --username <string>', 'Archive It API username.')

program.requiredOption('-p, --password <string>', 'Archive It API password.')

program.requiredOption('-i, --collection-id <string>', 'Id of the Archive It collection to process.')

program.addOption(
  new Option('-o, --output-path <string>', 'Path in which wacz-preparator will work.')
    .default(process.env.PWD)
)

program.addOption(
  new Option('-c, --concurrency <number>', 'Sets a limit for parallel requests to the Archive It API.')
    .default(50)
)

program.addOption(
  new Option('--auto-clear <bool>', 'Automatically delete the collection-specific folder that was created?')
    .choices(['true', 'false'])
    .default('false')
)

program.addOption(
  new Option('--signing-url <string>', 'Authsign-compatible endpoint for signing WACZ file.')
)

program.addOption(
  new Option('--signing-token <string>', 'Authentication token to --signing-url, if needed.')
)

program.addOption(
  new Option('--log-level <string>', 'Controls Scoop CLI\'s verbosity.')
    .choices(['silent', 'trace', 'debug', 'info', 'warn', 'error'])
    .default('info')
)

//
// Run
//
program.action(async (name, options, command) => {
  /** @type {?Preparator} */
  let collection = null

  //
  // Process options
  //
  options = options._optionValues

  // `options.username`, `options.password` and `options.collectionId` must be present
  if (!options?.username) {
    console.error('No Archive-It username provided.')
    process.exit(1)
  }

  if (!options?.password) {
    console.error('No Archive-It password provided.')
    process.exit(1)
  }

  if (!options?.collectionId) {
    console.error('No Archive-It collection Id provided.')
    process.exit(1)
  }

  // `options.outputPath` must be a folder and must be accessible.
  try {
    await fs.access(options.outputPath)

    const isDirectory = (await fs.lstat(options.outputPath)).isDirectory()
    assert(isDirectory, true)
  } catch (err) {
    console.error(`Output path does not exist or is not accessible: "${options.outputPath}"`)
    process.exit(1)
  }

  // Type conversions
  options.autoClear = options.autoClear === 'true'
  options.concurrency = Number(options.concurrency)

  //
  // Set log output level and formatting
  //
  logPrefix.reg(log)
  logPrefix.apply(log, {
    format (level, _name, timestamp) {
      const timestampColor = LOGGING_COLORS.DEFAULT
      const msgColor = LOGGING_COLORS[level.toUpperCase()]
      return `${timestampColor(`[${timestamp}]`)} ${msgColor(level)}`
    }
  })

  let level = 'info'

  if (['silent', 'trace', 'debug', 'info', 'warn', 'error'].includes(options.logLevel)) {
    level = options.logLevel
  }

  log.setLevel(level)
  log.info(`Log output level as been set to ${level}.`)

  //
  // Initialize Preparator
  //
  try {
    collection = new Preparator({ ...options, log })
  } catch (_err) {
    process.exit(1) // Logging handled by Preparator
  }

  //
  // Start assembling
  //
  try {
    await collection.process()
  } catch (err) {
    process.exit(1) // Logging handled by Preparator
  }

  //
  // Handle --auto-clear option
  //
  if (options.autoClear === true) {
    collection.log.info('Clearing collection folder.')
    await collection.clear()
  }

  process.exit(0)
})

program.parse()
