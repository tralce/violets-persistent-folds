# Frontmatter Folds

[![CI](https://github.com/tralce/obsidian-frontmatter-folds/actions/workflows/ci.yml/badge.svg)](https://github.com/tralce/obsidian-frontmatter-folds/actions/workflows/ci.yml)

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
  - type: heading
    path:
      - Project
      - Details
  - type: list
    under:
      - Project
      - Tasks
    path:
      - Backlog
      - Someday
---
```

Duplicate paths receive an `occurrence` number. You can edit the rules by hand;
run **Apply folds from frontmatter** to apply changes without reopening the note.

## Install development builds with BRAT

Add `tralce/obsidian-frontmatter-folds` as a beta plugin in BRAT. Every push to
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
`versions.json` into `.obsidian/plugins/frontmatter-folds/` in a vault.

## License

MIT
