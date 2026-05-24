# Build And Release

## Local Builds

Available package scripts:

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

## CI Workflow

The repository includes a GitHub Actions workflow at:

`/.github/workflows/build-release.yml`

## What CI Builds

### macOS

- `.dmg`
- `.zip`

### Windows

- `.exe`
- `.msi`
- Windows zip if produced

### Linux

- `.AppImage`
- `.deb`
- `.snap`

## Workflow Triggers

The workflow runs on:

- `workflow_dispatch`
- push to `main`
- pull requests

## macOS Entitlements

The macOS build uses:

`build/entitlements.mac.plist`

That file exists so the mac build does not fail on a missing entitlements path.

## Current Packaging Metadata

Configured in `electron-builder.yml`:

- app id: `com.blueberry.browser`
- product name: `BlueBerry Browser`

## Recommendation

If you want distributable releases next, add:

- a tag-based GitHub Release workflow
- artifact attachment to releases
- optional code signing / notarization setup
