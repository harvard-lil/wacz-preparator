import { readFile, rm, mkdir, access, appendFile, readdir } from 'fs/promises'
import { WritableStream } from 'node:stream/web'
import { constants as fsConstants } from 'node:fs'
import crypto from 'crypto'

import { parse as parseHTML } from 'node-html-parser'
import { WACZ } from '@harvard-lil/js-wacz'

import * as CONSTANTS from './constants.js'

export class Preparator {
}