# Violet's Persistent Folds

[![CI](https://github.com/tralce/violets-persistent-folds/actions/workflows/ci.yml/badge.svg)](https://github.com/tralce/violets-persistent-folds/actions/workflows/ci.yml)

An Obsidian plugin that persists heading and indented-list folds as stable,
human-readable frontmatter instead of workspace cache state or inline comments.

## Usage

1. Fold the headings and parent list items you want to persist.
2. The plugin syncs the changed fold state to frontmatter automatically.
3. Reopen the note. Its recorded folds are applied automatically.

The **Sync current folds to frontmatter** command remains available to force an
immediate sync. Syncing replaces the note's `folds` property with the current
heading and list folds; other foldable constructs are skipped. The generated
selectors use heading and list ancestry, so they survive unrelated lines being
inserted or removed.

```yaml
---
folds:
  - heading: Details
  - list: Someday
    persist: true
---
```

The plugin writes full paths only when duplicate heading or list names require
disambiguation.

Duplicate paths receive an `occurrence` number. You can edit the rules by hand;
run **Apply folds from frontmatter** to apply changes without reopening the note.

Add `persist: true` to a rule when temporarily unfolding it should not remove it
from frontmatter. Put the cursor on a heading or list item and run **Toggle
persistence for fold at cursor** to change this without editing YAML. Persistent
rules fold again the next time the note opens; non-persistent rules continue to
track the current fold state automatically.

## Install development builds with BRAT

Add `tralce/violets-persistent-folds` as a beta plugin in BRAT. Every push to
`main` is tested, built, and published as a uniquely versioned prerelease, which
lets BRAT detect and install each iteration automatically.

## Development

```sh
npm install
npm run dev
```

Run `npm run check` before committing. Push a semantic-version tag such as
`0.1.0` to build a GitHub release containing `main.js`, `manifest.json`, and
`versions.json`.

To build and install into a local vault in one step:

```sh
npm run build
npm run deploy -- /path/to/vault
```

## Installation from source

Build the project, then copy or symlink `main.js`, `manifest.json`, and
`versions.json` into `.obsidian/plugins/violets-persistent-folds/` in a vault.

## Migration from Frontmatter Folds

This plugin was previously named **Frontmatter Folds**, with the plugin ID
`frontmatter-folds` and repository `tralce/obsidian-frontmatter-folds`. The new
plugin imports settings from the old plugin directory when it has no settings
of its own. Old identifiers that remain in the migration code are intentional.

## License

MIT
