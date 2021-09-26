# MediaWiki LocalSettings.php Completions

Pulls the latest DefaultSettings.php from master and gets the default (if understood!) and comment.

Pull requests welcome!

![Example](demo.gif)

## Changelog

0.0.21

- New settings section under Extensions/LocalSettings.php
- Add  settings to turn off adding comments to completion
- Add switch for branch 

0.0.1

- Add  settings

## Build and install into code

```sh
npm run ci
```

```sh
npm run compile
```

```sh
code --install-extension MediaWiki-Localsettings-<VersionName>.vsix
```
