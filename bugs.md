# Electron Multi-Platform CI/CD & Publishing Blueprint

This document contains the complete, copy-paste ready setup for building, packaging, and releasing Electron applications across **Windows (`.exe`)**, **macOS (`.dmg`)**, and **Linux (`.AppImage` / `.deb`)** using GitHub Actions CI/CD, plus a standalone local Windows publisher.

---

## 1. Core Architecture

| Command | Where It Runs | Target Platforms | How It Works |
| :--- | :--- | :--- | :--- |
| **`npm run publish`** | **GitHub Actions (Cloud)** | 🪟 Windows (`.exe`)<br>🍏 macOS (`.dmg`)<br>🐧 Linux (`.AppImage`, `.deb`) | Auto-commits version bumps, tags the commit, pushes to GitHub, and triggers 3 cloud runners in parallel to compile and publish assets to GitHub Releases. |
| **`npm run publish:win`** | **Local PC (Windows)** | 🪟 Windows (`.exe`) | Compiles and packages locally on your Windows machine and uploads directly to GitHub Releases using your local environment token. |

---

## 2. Package Installation: What to Install

Run these commands in your new project root:

### Step 1: Install Runtime Dependencies
This package runs inside your packaged Electron application to check for and download updates:

```bash
npm install electron-updater
```

### Step 2: Install Development Dependencies
These tools are used to build, package, and upload releases:

```bash
npm install --save-dev electron-builder dotenv-cli
```

### Package Breakdown & Roles

| Package | Type | Why It Is Needed |
| :--- | :--- | :--- |
| **`electron-updater`** | `dependencies` | Runs inside your Electron app. Checks GitHub Releases for new updates (`latest.yml`), downloads the installer in the background, and prompts user to restart. |
| **`electron-builder`** | `devDependencies` | Compiles your app into native distribution packages: NSIS `.exe` (Windows), `.dmg` (macOS), and `.AppImage` / `.deb` (Linux), and uploads them to GitHub. |
| **`dotenv-cli`** | `devDependencies` | Used by `publish:win` (`dotenv -- electron-builder ...`) to load your local `.env` variables (like `GH_TOKEN`) into the command without hardcoding secrets in your repository. |

---

## 3. File 1: `package.json` Configuration

### Required Scripts & Sections
Add or update the following in `package.json`:

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "scripts": {
    "build": "electron-vite build",
    "postinstall": "electron-builder install-app-deps",
    "build:win": "npm run build && electron-builder --win",
    "build:mac": "npm run build && electron-builder --mac",
    "build:linux": "npm run build && electron-builder --linux",
    "publish": "node scripts/publish.mjs",
    "publish:win": "npm run build && dotenv -- electron-builder --win --publish always",
    "publish:mac": "npm run build && dotenv -- electron-builder --mac --publish always",
    "publish:linux": "npm run build && dotenv -- electron-builder --linux --publish always",
    "publish:all": "npm run build && dotenv -- electron-builder --win --mac --linux --publish always"
  },
  "devDependencies": {
    "dotenv-cli": "^11.0.0",
    "electron": "^39.0.0",
    "electron-builder": "^26.0.0",
    "electron-updater": "^6.6.0"
  },
  "win": {
    "icon": "resources/icon.ico",
    "publish": [
      {
        "provider": "github",
        "owner": "YOUR_GITHUB_USERNAME",
        "repo": "YOUR_REPO_NAME"
      }
    ]
  }
}
```

> **Important**:
> - **Do NOT include `patch-package` in `postinstall`** unless `patch-package` is installed and a `patches/` folder exists. Otherwise, `npm ci` will crash on GitHub Actions runners with `command not found`.
> - Ensure `"win.icon"` points to an existing file in `resources/` (e.g. `resources/icon.ico`), NOT to a git-ignored folder like `build/`.

---

## 4. File 2: `electron-builder.yml`

Create or update `electron-builder.yml` at the project root:

```yaml
appId: io.yourcompany.app
productName: YourAppName
icon: resources/icon.png
directories:
  buildResources: resources
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
asarUnpack:
  - resources/**
extraResources:
  - from: resources
    to: .
    filter:
      - "**/*"

win:
  icon: resources/icon.ico
  executableName: YourAppName
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
  oneClick: true
  perMachine: false

mac:
  icon: resources/icon.png
  extendInfo:
    - NSCameraUsageDescription: Application requests access to the device camera.
    - NSMicrophoneUsageDescription: Application requests access to the device microphone.
    - NSDocumentsFolderUsageDescription: Application requests access to the user Documents folder.
    - NSDownloadsFolderUsageDescription: Application requests access to the user Downloads folder.
  notarize: false
dmg:
  artifactName: ${name}-${version}.${ext}

linux:
  target:
    - AppImage
    - deb
  maintainer: your-email@example.com
  category: Utility
appImage:
  artifactName: ${name}-${version}.${ext}

npmRebuild: false
publish:
  provider: github
  owner: YOUR_GITHUB_USERNAME
  repo: YOUR_REPO_NAME
```

> **Warning**:
> Do NOT set `entitlementsInherit: build/entitlements.mac.plist` unless that `.plist` file is actually tracked in git. If it's missing or in `.gitignore`, macOS builds on GitHub Actions will crash.

---

## 5. File 3: `.github/workflows/release.yml`

Create `.github/workflows/release.yml` for multi-platform GitHub Actions builds:

```yaml
name: Release App

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  release:
    name: Build & Publish (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install Linux Dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libfuse2

      - name: Install Dependencies
        run: npm ci

      - name: Build Application
        run: npm run build

      - name: Publish Release Artifacts
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN || secrets.GITHUB_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN || secrets.GITHUB_TOKEN }}
          CSC_IDENTITY_AUTO_DISCOVERY: false
        run: npx electron-builder --publish always
```

### Critical Rules in this Workflow:
1. `permissions: contents: write`: Grants GitHub's built-in `GITHUB_TOKEN` write permissions to create releases and upload installer assets. No manual tokens or secrets are needed.
2. `fail-fast: false`: If one operating system fails, the other runners won't be cancelled and will still complete and publish their files.
3. `sudo apt-get install -y libfuse2`: Required on Ubuntu runners (`ubuntu-latest` / Ubuntu 24.04) for AppImage packaging.
4. `CSC_IDENTITY_AUTO_DISCOVERY: false`: Prevents macOS runners from failing when looking for Apple Developer certificates if unsigned builds are used.

---

## 6. File 4: `scripts/publish.mjs`

Create `scripts/publish.mjs`. This script completely automates checking for uncommitted files, committing, pushing, tagging, and force-pushing:

```javascript
import { execSync } from 'child_process'
import fs from 'fs'

try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const version = pkg.version
  const tagName = `v${version}`

  console.log(`\n🚀 CI/CD Release Trigger`)
  console.log(`──────────────────────────────────────────`)
  console.log(`Version: ${version}`)
  console.log(`Tag:     ${tagName}\n`)

  // Ensure uncommitted changes (like package.json version bump) are committed and pushed
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
  if (status) {
    console.log(`📝 Staging and committing changes for ${tagName}...`)
    execSync('git add -A', { stdio: 'inherit' })
    execSync(`git commit -m "chore(release): ${tagName}"`, { stdio: 'inherit' })
    console.log(`📤 Pushing branch commits to origin...`)
    execSync('git push', { stdio: 'inherit' })
  }

  let tagExists = false
  try {
    const existingTags = execSync('git tag', { encoding: 'utf8' })
    if (existingTags.split('\n').map((t) => t.trim()).includes(tagName)) {
      tagExists = true
    }
  } catch (_) {}

  if (!tagExists) {
    console.log(`📌 Creating Git tag: ${tagName}`)
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' })
  } else {
    console.log(`ℹ️ Git tag ${tagName} already exists. Updating tag to current commit...`)
    execSync(`git tag -f -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' })
  }

  console.log(`📤 Pushing ${tagName} to GitHub...`)
  execSync(`git push origin ${tagName} --force`, { stdio: 'inherit' })

  console.log(`\n✅ CI/CD Pipeline Triggered Successfully!`)
  console.log(`──────────────────────────────────────────`)
  console.log(`🌐 GitHub Actions is now building in parallel:`)
  console.log(`   • Windows Installer (.exe)`)
  console.log(`   • macOS Disk Image (.dmg)`)
  console.log(`   • Linux Package (.AppImage / .deb)\n`)
} catch (err) {
  console.error('\n❌ Release trigger failed:', err.message)
  process.exit(1)
}
```

---

## 7. Auto-Updater & Repository Visibility Rules

### 🚨 Critical Rule for `electron-updater`:
1. **Repository Visibility Must Be PUBLIC**:
   GitHub Releases for **Private** repositories require an authenticated GitHub token header on every HTTP request. Without a token, GitHub returns `404 Not Found`.
   Because client apps installed on user machines cannot safely store your private personal GitHub token, **the repository must be Public** for in-app auto-updates (`electron-updater`) to check `latest.yml` and download update files.
2. **Draft Releases Are Invisible to Auto-Updaters**:
   When electron-builder uploads assets, if the release remains in **Draft** state on GitHub, auto-updaters will ignore it.
   Go to GitHub → **Releases** → Click **Edit (pencil)** → Click **"Publish release"**.

---

## 8. How to Release in Daily Workflow

Whenever you are ready to publish a new release:

1. Change the `"version"` in `package.json` (e.g. `1.0.52`).
2. Run:
   ```bash
   npm run publish
   ```
3. The script will automatically:
   - Commit the version bump
   - Push to your git branch
   - Tag the commit (`v1.0.52`) and force-push the tag
   - Trigger GitHub Actions for Windows, macOS, and Linux
4. Watch progress live at: `https://github.com/YOUR_USER/YOUR_REPO/actions`
5. After ~5 minutes, all 3 operating system installers are live on your GitHub Releases page!
