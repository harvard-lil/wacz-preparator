#! /usr/bin/env node

import fs from 'fs/promises'
import path from 'path'

import { Command, Option } from 'commander'

import { PACKAGE_INFO } from '../constants.js'

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
