# wacz-preparator 📚

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fwacz-preparator.svg)](https://badge.fury.io/js/@harvard-lil%2Fwacz-preparator) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) [![Linting](https://github.com/harvard-lil/wacz-preparator/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/harvard-lil/wacz-preparator/actions/workflows/lint.yml)

CLI and JavaScript library for compiling an [Archive-It](https://archive-it.org/) web archives collection into a single [WACZ file](https://specs.webrecorder.net/wacz/1.1.1/).

> ⚠️🥼🧪 **Experimental - feedback needed:**
>
> This pipeline was originally developed in the context of [The Harvard Library Innovation Lab](https://lil.law.harvard.edu)'s partnership with the [Radcliffe Institute's Schlesinger Library](https://www.radcliffe.harvard.edu/schlesinger-library) on [experimental access to web archives](https://www.schlesinger-metooproject-radcliffe.org/access-the-collection).
>
> We have only tested it on [The Schlesinger #meToo Web Archives collection](https://www.schlesinger-metooproject-radcliffe.org/web-archives) and would welcome feedback from the community to help solidify it.
>
> In particular, we would love to hear more about:
> - Any edge cases this pipeline currently doesn't account for.
> - General interest in exporting web archives collections from Archive-It and self-hosting web archives exhibits. 
> - Interest in a desktop app version of this pipeline.
> 
> **Contact**: `info@perma.cc`

**See also:** [warc-embed](https://github.com/harvard-lil/warc-embed) for embedding a self-contained web archive collection on a web page. 

<a href="https://tools.perma.cc"><img src="https://github.com/harvard-lil/tools.perma.cc/blob/main/perma-tools.png?raw=1" alt="Perma Tools" width="150"></a>

---

## Summary
- [How does it work?](#how-does-it-work)
- [Getting Started](#getting-started)
- [CLI](#cli)
- [JavaScript library](#javascript-library)
- [Development](#development)

---

## How does it work?

Given a valid combination of credentials, **wacz-preparator** will perform the following steps in order to process an existing Archive-It collection:
1. Check validity of credentials and access to the collection
2. Create local collection folder if not already present
    - Because the underlying files are kept around in that folder, processing can be interrupted, resumed, and run multiple times over
3. Ask Archive-It for: Collection information
4. Ask Archive-It for: List of available WARC files
5. Ask Archive-It for: Pull crawl information for all WARC files.
    - This includes the different **seeds** they captured.
6. Ask Archive-It for: The page title for all the crawled URLs.
    - Will first try to fetch that information from the **seed** meta data
    - If not available, will try to pull that information from the **Wayback Machine**
7. Delete _"loose"_ WARCs from local collection folder
    - This comparison allows for discarding WARC files that may have previously been pulled locally but are no longer part of the collection. 
8. Compare hashes of local WARC files against remote hashes (1)
    - This allows for determining what files need to be downloaded or re-downloaded.
9. Ask Archive-It for: WARCs 
10. Compare hashes of local WARC files against remote hashes (1)
    - At this stage, there should be no discrepancies.
11. Build pages list 
12. Prepare WACZ file

All of the operations that involve talking to the Archive-It API are run in parallel batches: the `--concurrency` option allows for determining how many requests can be run in parallel.

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
wacz-preparator --username 'foo' --password 'bar' --collection-id 12345

# ... the latter can / should be passed as an environment variable
wacz-preparator --username 'foo' --password $PASSWORD --collection-id 12345

# Unless specified otherwise with --output-path, wacz-preparator will work in the current directory
wacz-preparator --output-path "/path/to/directory" --username 'foo' --password $PASSWORD --collection-id 12345

# The resulting WACZ file can be signed using an authsign-compatible endpoint.
# See: https://specs.webrecorder.net/wacz-auth/0.1.0/#implementations
wacz-preparator --signing-url "https://example.com/sign" --username foo --password $PASSWORD --collection-id 12345

# Use --help to list the available options, and see what the defaults are.
wacz-preparator --help
```

<details>
  <summary><strong>See: Output of wacz-preparator --help 🔍</strong></summary>

```
Usage: wacz-preparator [options]

📚 CLI and JavaScript library for compiling an Archive-It web archives collection into a single WACZ file.
More info: https://github.com/harvard-lil/wacz-preparator

Options:
  -v, --version                 Display Library and CLI version.
  -u, --username <string>       Archive-It API username.
  -p, --password <string>       Archive-It API password.
  -i, --collection-id <string>  Id of the Archive-It collection to process.
  -o, --output-path <string>    Path in which wacz-preparator will work. (default: "[current folder]")
  -c, --concurrency <number>    Sets a limit for parallel requests to the Archive-It API. (default: 40)
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
import { Preparator } from "@harvard-lil/wacz-preparator"

const collection = new Preparator({
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

### Quick access
- [Preparator options and defaults](https://github.com/harvard-lil/wacz-preparator/blob/main/index.js#L80)
- [Process() method](https://github.com/harvard-lil/wacz-preparator/blob/main/index.js#L109)

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
> ⚠️ This project doesn't have an automated test suite at the moment.

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


