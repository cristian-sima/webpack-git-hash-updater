/* eslint-enable */
/* eslint-disable no-console */
/* globals module */
/* eslint-disable @typescript-eslint/no-var-requires */

const
  fs = require("fs"),
  path = require("path"),
  childProcess = require("child_process"),
  colors = require("cli-color");

const
  charsFromLastCommitHash = 7,
  pluginName = "WebpackGitHashUpdater";

class WebpackGitHash5 {

  /**
  * Setup bindings and options
  */
  constructor (opts = {}) {

    this.opts = opts;

    this.doPlaceholder = this.doPlaceholder.bind(this);
    this.cleanupFiles = this.cleanupFiles.bind(this);
    this.loopFiles = this.loopFiles.bind(this);
    this.deleteObsoleteFile = this.deleteObsoleteFile.bind(this);

    // If not cleaning up, bind the callback directly
    if (!this.cleanup) {
      this.doCallback = this.doCallback.bind(this);
    }

    // Optional callback function that receives the hash and list of deleted files
    this.callback = opts.callback || null;
    if (typeof this.callback === "function") {
      this.callback = this.callback.bind(this);
    }

    // Custom placeholder or default to [githash]
    this.placeholder = opts.placeholder || "[githash]";

    // Delete old versions?
    this.cleanup = opts.cleanup || false;

    // Can specify a specific hash/version
    if (opts.skipHash) {
      this.skipHash = opts.skipHash;
      this.hashLength = this.skipHash.length;
    } else {
      // Or specify how many chars to use from the last commit hash
      this.hashLength = opts.hashLength || charsFromLastCommitHash;
      this.skipHash = WebpackGitHash5.getSkipHash(this.hashLength);
    }

    // Can specify output path
    this.outputPath = opts.outputPath || null;

    // Pre-specify regexes for filename and chunkFilename
    this.regex = opts.regex || {};

    // Config filled in later
    this.updated = {};
    this.deletedFiles = [];
    this.stats = null;
  }

  /**
  * Test if a file can be deleted, then delete it
  */
  deleteObsoleteFile (filename) {
    if ((this.regex.filename && this.regex.filename.test(filename)) ||
       (this.regex.chunkFilename && this.regex.chunkFilename.test(filename))) {
      // delete synchronously so we know when loopFiles() is complete
      fs.unlinkSync(path.join(this.outputPath, filename));
      WebpackGitHash5.log(`Deleted ${colors.cyanBright(filename)}`);
      this.deletedFiles.push(filename);
    }
  }

  /**
  * Loop through files after reading folder contents
  */
  loopFiles (err, contents) {
    if (err) {
      throw err;
    }
    contents.forEach(this.deleteObsoleteFile);
    this.doCallback();
  }

  /**
  * Callback function if one exists
  */
  doCallback (stats = this.stats) {
    // Webpack stats passed directly, or stored earlier, or null
    if (typeof this.callback === "function") {
      this.callback(this.skipHash, this.deletedFiles, stats);
    }
  }

  /**
  * Delete static chunk JS files containing a hash other than the one we want to skip
  */
  cleanupFiles (stats) {
    // eslint-disable-next-line
    WebpackGitHash5.log(`Cleaning up Webpack files; skipping ${colors.cyanBright(this.placeholder)} : ${colors.cyanBright(this.skipHash)}`);

    // Save Webpack stats for later
    if (stats) {
      this.stats = stats;
    }

    fs.readdir(this.outputPath, this.loopFiles);
  }


  /**
  * Attempt to replace the placeholder string in a output string
  */
  doPlaceholder (key, original) {
    const newString = original.replace(this.placeholder, this.skipHash);

    if (newString === original) {
      return false;
    }
    this.regex[key] = this.regex[key] || WebpackGitHash5.buildRegex(newString, this.skipHash);
    return newString;
  }

  /**
  * Hook into webpack plugin architecture
  */
  apply (compiler) {

    // WebpackGitHash5.log(colors.cyanBright("Started"));

    // [
    //   `this.cleanup:${this.cleanup}`,
    //   `this.updated.filename:${this.updated.filename}`,
    //   `this.updated.chunkFilename:${this.updated.chunkFilename}`,
    //   `this.outputPath:${this.outputPath}`,
    //   "",
    //   `compiler.options.output.filename: ${compiler.options.output.filename}`,
    //   `compiler.options.output.chunkFilename:${compiler.options.output.chunkFilename}`,
    //   `compiler.options.output.path:${compiler.options.output.path}`,

    // ].forEach(WebpackGitHash5.log);

    // Process filename and chunkFilename
    this.updated.filename = (
      compiler.options.output.filename
        ? this.doPlaceholder("filename", compiler.options.output.filename)
        : false
    );

    if (this.updated.filename) {
      compiler.options.output.filename = this.updated.filename;
      WebpackGitHash5.log(
        `Changed output.filename to ${colors.cyanBright(compiler.options.output.filename)}`,
      );
    }

    this.updated.chunkFilename = (
      compiler.options.output.chunkFilename
        ? this.doPlaceholder("chunkFilename", compiler.options.output.chunkFilename)
        : false
    );

    if (this.updated.chunkFilename) {
      compiler.options.output.chunkFilename = this.updated.chunkFilename;
      WebpackGitHash5.log(
        `Changed output.chunkFilename to ${colors.cyanBright(compiler.options.output.chunkFilename)}`,
      );
    }

    if (!this.outputPath) {
      this.outputPath = compiler.options.output.path;
    }


    // [
    //   "at the end ",
    //   `this.cleanup:${this.cleanup}`,
    //   `this.updated.filename:${this.updated.filename}`,
    //   `this.updated.chunkFilename:${this.updated.chunkFilename}`,
    //   `this.outputPath:${this.outputPath}`,
    //   "",
    //   `compiler.options.output.filename: ${compiler.options.output.filename}`,
    //   `compiler.options.output.chunkFilename:${compiler.options.output.chunkFilename}`,
    //   `compiler.options.output.path:${compiler.options.output.path}`,

    // ].forEach(WebpackGitHash5.log);

    if (this.cleanup === true && (this.updated.filename || this.updated.chunkFilename)) {
      compiler.hooks.done.tap(pluginName, this.cleanupFiles);
    } else {
      compiler.hooks.done.tap(pluginName, this.doCallback);
    }

    // WebpackGitHash5.log(colors.cyanBright("Ended"));
  }

  /**
  * Get hash of last git commit
  */
  static getSkipHash (length) {
    const skipHash = (
      childProcess.execSync(`git rev-parse --short=${length} HEAD`, { encoding: "utf8" })
    );

    return skipHash.trim();
  }

  /**
  * Turn processed filename into regex for later cleanup
  */
  static buildRegex (template, hash) {
  // discard any prepended directories
    const parts = template.split("/");

    let
      regex = parts.pop();

    // Replace Webpack placeholders, e.g.
    // '[name]-chunk.1234567.min.js' -> '[-_\\w]+-chunk.1234567.min.js'
    regex = regex.replace(/\[\w+\]/giu, "[-_\\w]+");

    // escape dots, e.g.
    // '\\w+-chunk.1234567.js' -> '\\w+-chunk\\.1234567\\.js'
    regex = regex.replace(/\./gu, "\\.");

    // replace hash
    // '\\w+-chunk\\.1234567\\.min\\.js' -> '\\w+-chunk\\.(?!1234567)\\w{7}\\.min\\.js'
    regex = regex.replace(hash, `(?!${hash})\\w{${hash.length}}`);

    // eslint-disable-next-line require-unicode-regexp
    return new RegExp(regex);
  }

  static log (text) {
    console.log(`<i> ${colors.greenBright("[webpack-dev-server] [webpack-git-hash-updater]")} ${text}`);
  }
}


module.exports = WebpackGitHash5;
