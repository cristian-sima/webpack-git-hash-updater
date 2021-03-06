# webpack-git-hash-updater

![image](https://user-images.githubusercontent.com/12199042/151424981-d1530c0a-2baf-4e4c-8aef-1ba1b04140cc.png)

## It requires **webpack version 5**!

*If you need to use webpack v4 please use this script [here](https://github.com/alleyinteractive/webpack-git-hash)*.

#

This is a Webpack v5 for solving problem of caching the same content served by the webpack bundle, by altering the `githash` of the js files from your HTML files. 

## How to install 

```
npm install webpack-git-hash-updater
```

## Simple example

Your HTML files are in the `/static/` folder

```jsx

const
  fs = require("fs"),
  colors = require("cli-color"),
  webpack = require("webpack"),

  WebpackGitHashUpdater = require("webpack-git-hash-updater"),

  entries = [
    {
      name : "game",
      path : "Game/entryPoint",
    },
    {
      name : "console",
      path : "Console/entryPoint",
    },
  ],

  gitHashPlugin = new WebpackGitHashUpdater({
    cleanup  : true,
    callback : (hash) => entries.map(({ name }) => {

      const filename = `${indexFolderPath}/${name}.html`;

      return fs.readFile(filename, "utf8", (errRead, data) => {

        if (errRead) {
          return console.log(errRead);
        }

        const
          reg = new RegExp(`src="\/static\/${name}-\\w+.js"`, "u"),
          newData = data.replace(
            reg,
            `src="/static/${name}-${hash}.js"`,
          );

        return fs.writeFile(filename, newData, (errWrite) => {
          if (errWrite) {
            return console.log(errWrite);
          }

          WebpackGitHash5.log(
            `File ${colors.cyanBright(filename)} updated. hash: ${colors.cyanBright(hash)}`,
          );
          return null;
        });
      });
    }),
  });

 // ... bla bla bla other things
  
  webpackConfiguration = {
    // .... other things
    plugins: isDevelopmentMode ? [
		gitHashPlugin,
	] : []
	// ... other things
  };

```

## Why?

Webpack already [gives](https://webpack.github.io/docs/long-term-caching.html) you the `[hash]` placeholder, which serves exactly this purpose. This plugin has a couple advantages:

1. Using the Git hash in the filename allows you to very quickly pinpoint where in the commit history to look for any issues you encounter on a production site.
1. The plugin can automatically delete old versions of the files it affects. Depending on how you manage static assets, this might be useful.
1. You can specify the length of the hash. If you have some crazy restriction on the number of characters in your file names, maybe this will help.

## How it works ?

Use the placeholder `[githash]` in your config.

```jsx
var WebpackGitHash = require('webpack-git-hash-updater');

module.exports = {
	output: {
		filename: 'bundle.[githash].js',
		chunkFilename: '[name]-chunk.[githash].js'
	},
	plugins: [
		new WebpackGitHash()
	]
}
```

### Options

You can pass these options when you instantiate the plugin in your `plugins` array:

#### `placeholder`
Defaults to `[githash]`. Pass another string to use as the placeholder in filenames.

#### `cleanup`
Defaults to `false`. Pass `true` to delete old versions after Webpack is finished. This works by searching for files in the output directory that match the same pattern as the files that were just compiled, except for the hash. Note the the number of characters in the hash must match. For example:

```jsx
bundle.gha3k8d.js -> the newly compiled bundle
bundle.lk8adsm.js -> would be deleted
bundle.987aas880m.js -> would *NOT* be deleted
```

#### `callback`
Optional callback function that runs on Webpack's `done` [step](https://webpack.github.io/docs/plugins.html#done). It receives three arguments:

1. `hash` The hash used as the latest version by the plugin (_not_ Webpack's `[hash]`).
1. `deletedFiles` Array of any filenames (without path) deleted during cleanup; this might be an empty array.
1. `stats` Webpack [stats](https://webpack.github.io/docs/node.js-api.html#stats) object from the latest compilation

#### `skipHash`

Defaults to hash of most recent Git commit on the current branch. This is the unique string that will be used as the version identifier, and will be "skipped" if the plugin is set to delete old versions when Webpack is finished. See `cleanup` above.

#### `hashLength`

Defaults to 7 characters, which is Git's default for a "short" hash. `hashLength` can be specified _only_  when `skipHash` is not specified. If `skipHash` _is_ specified, then `hashLength` is set to the number of characters in `skipHash`.

#### `outputPath`

Defaults to `output.path` in your Webpack config. You can change that here though; an *absolute* path is recommended since that's what Webpack tends to use.

#### `regex`

If you use the `cleanup` option to delete old verions, the plugin attempts to create regular expressions to match the filenames, based on the original Webpack config. For instance:
```
[name]-chunk.[githash].min.js -> the config's output.chunkFilename
abcd123 -> the latest Git hash
/\w+-chunk\.(?!abcd123)\w{7}\.min\.js/ -> the default regex
global-chunk.1234abc.min.js -> this would be deleted
```
If the default regex isn't working for you, you can specify a new `RegExp` in `regex.filename` and/or `regex.chunkFilename`. Note that there's not (yet) a way to dynamically skip the current Git hash (the `(?!abcd123)` part in the example). So if you use this option, you'll need to use the `skipHash` option also.

## Post-compilation updates

Here's a simple example of how to use the `callback` option to edit a `<script>` tag to load the load the latest versionof a file.

```jsx
module.exports = {
	plugins: [
		new WebpackGitHash({
			cleanup: true,
			callback: function(versionHash) {
				var indexHtml = fs.readFileSync('./index.html', 'utf8');
				indexHtml = indexHtml.replace(/src="\/static\/app-bundle\.\w+\.js/, 'src="/static/app-bundle.' + versionHash + '.js');
				fs.writeFileSync('./index.html', indexHtml);
			}
		})
	]
}
```

# Acknowledgment

This script was inspired by [v4 original script](https://github.com/alleyinteractive/webpack-git-hash)
