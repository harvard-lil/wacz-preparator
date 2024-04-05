# wacz-preparator 📚

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fwacz-preparator.svg)](https://badge.fury.io/js/@harvard-lil%2Fwacz-preparator) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![Linting](https://github.com/harvard-lil/wacz-preparator/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/harvard-lil/wacz-preparator/actions/workflows/lint.yml)

> ⚠️  **Please note**
>
> This repo is no longer under active development. Because it may still be useful, we have chosen not to archive it. If you use it, you may want to ensure that dependencies are up to date. If you find it useful, we would [love to know](mailto:lil@law.harvard.edu)! You can also file an issue or a pull request, though we may not respond as promptly as we would for a codebase under active development.

CLI and Javascript library for packaging a remote web archive collection into a single [WACZ file](https://specs.webrecorder.net/wacz/1.1.1/).

```bash
wacz-preparator --extractor "archive-it" --username "lil" --password $PASSWORD --collection-id 12345
```

**See also:** [wacz-exhibitor](https://github.com/harvard-lil/wacz-exhibitor) for embedding a self-contained web archive collection on a web page. 

<a href="https://tools.perma.cc"><img src="https://github.com/harvard-lil/tools.perma.cc/blob/main/perma-tools.png?raw=1" alt="Perma Tools" width="150"></a>

---

## Summary
- [Foreword](#foreword)
- [How does it work?](#how-does-it-work)
- [Getting Started](#getting-started)
- [CLI](#cli)
- [JavaScript library](#javascript-library)
- [Development](#development)

---

## Foreword

⚠️🥼🧪 **Experimental:**

This pipeline was originally developed in the context of [The Harvard Library Innovation Lab](https://lil.law.harvard.edu)'s partnership with the [Radcliffe Institute's Schlesinger Library](https://www.radcliffe.harvard.edu/schlesinger-library) on [experimental access to web archives](https://www.schlesinger-metooproject-radcliffe.org/access-the-collection).

We have only tested it on [The Schlesinger #meToo Web Archives collection](https://www.schlesinger-metooproject-radcliffe.org/web-archives) and would welcome feedback from the community to help solidify it.

In particular, we would love to hear more about:

- Any edge cases this pipeline currently doesn't account for.
- General interest in exploring new ways of storing, copying, and giving access to web archives

**Contact**: `info@perma.cc`

[👆 Back to the summary](#summary)

---

## How does it work?

Given a specific extractor and valid combination of credentials, **wacz-preparator** will perform the following steps in order to pull and package a remote web archives collection into a single WACZ file.


### Example: Archive-It Extractor

| # | Description | Notes |
| --- | --- | -- |
| 01 | Check validity of credentials and access to the collection | | 
| 02 | Create local collection folder if not already present | Because the underlying files are kept around in that folder, processing can be interrupted, resumed, and run multiple times over. | 
| 03 | Pull Collection Information | |
| 04 | Pull list of available WARC files | |
| 05 | Pull crawl information for all WARC files | This includes retrieving **seeds** (urls).|
| 06 | Pull page title for all of the crawled URLs | Will first try to fetch that information from the **seed** meta data. If not available, will try to pull that information from the **Wayback Machine**. |
| 07 | Delete _"loose"_ WARCs from local collection folder | This comparison allows for discarding WARC files that may have previously been pulled locally but are no longer part of the collection. |
| 08 | Compare hashes of local WARC files against remote hashes (1) | This allows for determining what files need to be downloaded or re-downloaded. |
| 09 | Pull WARC files | Only the files that are not already present locally will be pulled. |
| 10 | Compare hashes of local WARC files against remote hashes (2) | At this stage, there should be no discrepancies. |
| 11 | Build pages list | | 
| 12 | Prepare WACZ file | |

At the end of this process, **a WACZ file named after the collection ID should be available (ie: 12345.wacz)**. 

WACZ files can be read with any compatible playback software, such as [replayweb.page](https://replayweb.page).

**Note:** All of the operations that involve talking to the Archive-It API are run in parallel batches: the `--concurrency` option allows for determining how many requests can be run in parallel.

[👆 Back to the summary](#summary)

---

## Getting Started

### Dependencies 
**wacz-preparator** requires [Node.js 18+](https://nodejs.org/en/). 

### Compatibility
This program has been written for UNIX-like systems and is expected to work on **Linux, Mac OS, and Windows Subsystem for Linux**.

### Installation
**wacz-preparator** is available on [npmjs.org](https://www.npmjs.com/package/@harvard-lil/wacz-preparator) and can be installed as follows:
 
```bash
# As a CLI
npm install -g @harvard-lil/wacz-preparator

# As a library
npm install @harvard-lil/wacz-preparator --save
```

[👆 Back to the summary](#summary)

---

## CLI

Here are a few examples of how **wacz-preparator** can be used in the command line to extract a full collection from Archive-It into a WACZ file:

```bash
# The program needs an Archive-It username, password, and collection-id to operate ...
wacz-preparator --extractor "archive-it" --username 'foo' --password 'bar' --collection-id 12345

# ... the latter can / should be passed as an environment variable
wacz-preparator --extractor "archive-it"  --username 'foo' --password $PASSWORD --collection-id 12345

# Unless specified otherwise with --output-path, wacz-preparator will work in the current directory
wacz-preparator --extractor "archive-it"  --output-path "/path/to/directory" --username 'foo' --password $PASSWORD --collection-id 12345

# The resulting WACZ file can be signed using an authsign-compatible endpoint.
# See: https://specs.webrecorder.net/wacz-auth/0.1.0/#implementations
wacz-preparator --extractor "archive-it" --signing-url "https://example.com/sign" --username foo --password $PASSWORD --collection-id 12345

# Use --help to list the available options, and see what the defaults are.
wacz-preparator --help
```

<details>
  <summary><strong>See: Output of wacz-preparator --help 🔍</strong></summary>

```
Usage: wacz-preparator [options]

📚 CLI and Javascript library for packaging a remote web archive collection into a single WACZ file.
More info: https://github.com/harvard-lil/wacz-preparator

Options:
  -v, --version                 Display Library and CLI version.
  -e, --extractor <string>      Web Archiving platform to extract the collection from. (choices: "archive-it", default: "archive-it")
  -u, --username <string>       API username (required for Archive-it). (default: null)
  -p, --password <string>       API password (required for Archive-it). (default: null)
  -i, --collection-id <string>  Id of the collection to process (required for Archive-it). (default: null)
  -o, --output-path <string>    Path in which wacz-preparator will work. (default: pwd)
  -c, --concurrency <number>    Sets a limit for parallel requests to the Archive-It API. (default: 50)
  --auto-clear <bool>           Automatically delete the collection-specific folder that was created? (choices: "true", "false", default: "false")
  --signing-url <string>        Authsign-compatible endpoint for signing WACZ file.
  --signing-token <string>      Authentication token to --signing-url, if needed.
  --log-level <string>          Controls CLI verbosity. (choices: "silent", "trace", "debug", "info", "warn", "error", default: "info")
  -h, --help                    Show options list.
```
</details>

[👆 Back to the summary](#summary)

---

## JavaScript Library

**wacz-preparator** can also be used as JavaScript library in a Node.js project. 

### Example: Using the Preparator.process() method
```javascript
import { ArchiveItExtractor } from "@harvard-lil/wacz-preparator"

const collection = new ArchiveItExtractor({
  username: 'username', 
  password: 'password', 
  collectionId: 12345
})

if (await collection.process()) {
  // WACZ file is ready!
  // ... 
}
```

The `process()` method runs through all the steps described in the ["How does it work?"](how-does-it-work) section.

It is also possible to go through each individual step manually and customize the behavior of **wacz-preparator**.

[👆 Back to the summary](#summary)

---

## Development

### Standard JS
This codebase uses the [Standard JS](https://standardjs.com/) coding style. 
- `npm run lint` can be used to check formatting.
- `npm run lint-autofix` can be used to check formatting _and_ automatically edit files accordingly when possible.
- Most IDEs can be configured to automatically check and enforce this coding style.

### JSDoc
[JSDoc](https://jsdoc.app/) is used for both documentation and loose type checking purposes on this project.

### Testing
> ⚠️ In its current state, this experimental codebase doesn't come with an automated test suite. 

### Available CLI

```bash
# Runs linter
npm run lint

# Runs linter and attempts to automatically fix issues
npm run lint-autofix

# Step-by-step NPM publishing helper
npm run publish-util
```

[👆 Back to the summary](#summary)


