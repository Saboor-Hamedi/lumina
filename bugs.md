# Resolved Issues

## 1. `index.html?html-proxy&index=0.ts: Unexpected "!"` (Fixed)
- **Root Cause**: An inline `<script type="module">` in `index.html` importing `screenLoader.ts` caused Vite to create a virtual `html-proxy` module. During transform/esbuild resolution, the proxy module was parsed improperly as a TypeScript file.
- **Resolution**:
  1. Removed the inline `<script>` from `index.html` and relocated `initScreenLoader()` to the top of `src/main.jsx`.
  2. Vite no longer generates `html-proxy` virtual modules for `index.html`.
  3. Added explicit negative guards (`!str.includes('html-proxy') && !str.includes('node_modules')`) in `electron.vite.config.mjs`.
  4. Wiped `node_modules/.vite` cache.

## 2. `Failed to resolve dependency: react-window` (Fixed)
- **Root Cause**: `electron.vite.config.mjs` still had `optimizeDeps: { include: ['react-window'] }` even though the app migrated to `react-virtuoso` and `react-window` was removed from dependencies.
- **Resolution**: Removed `optimizeDeps.include: ['react-window']` from `electron.vite.config.mjs`.

## 3. `No electron app entry file found: out\main\index.js` (Fixed)
- **Root Cause**: Deleting `out/` deleted Electron's compiled main process entry point.
- **Resolution**: Rebuilt `out/` via `electron-vite build`. `out/main/index.js` (271 kB) and `out/preload/index.js` (12.98 kB) are verified intact.

## 4. TypeScript Feature Migrations (Completed)
- **Files Migrated**:
  1. `Welcome.jsx` -> `Welcome.tsx`
  2. `Profile.jsx` -> `Profile.tsx`
  3. `PreviewCommandPalette.jsx` -> `PreviewCommandPalette.tsx`
  4. `Preview.jsx` -> `Preview.tsx`
  5. `CommandPalette.jsx` -> `CommandPalette.tsx`
- **Resolution**:
  - Fully typed props, data structures, and callbacks with zero `any` leaks.
  - Superseded `.jsx` files deleted to eliminate disk duplicates.
  - `electron.vite.config.mjs` updated to include new paths in dev-server resolver.

## 5. Instant Note Opening & Zero-Jank Switching (Polished)
- **Root Causes**:
  - `setSelectedNote` and `setActiveTabId` triggered full state re-renders even when clicking the already-active note or tab.
  - `renderedEditors` recalculated on any note edit because the full `selectedSnippet` object was in the dependency array.
  - In `MainLayout`, finding snippets for open tabs executed an O(N*M) array scan.
  - `handleToggleInspector` invalidated on tab switch due to `rightSidebarTab` state dependency.
- **Resolution**:
  - Added identity guards to `setSelectedNote` and `setActiveTabId` in `workspaceStore.ts`.
  - Converted tab lookup to O(1) `Map` lookup (`snippetMap`).
  - Switched `renderedEditors` dependency to `selectedSnippet?.id` and `activeTabId`, preventing editor re-renders during active note typing.
  - Stabilized `handleToggleInspector` with `rightSidebarTabRef`.

## 6. Layout Feature TypeScript Migration & Barrel Architecture (Completed)
- **Files Migrated to `.tsx`**:
  1. `StatusBar.jsx` -> `StatusBar.tsx`
  2. `TabBar.jsx` -> `TabBar.tsx`
  3. `TabContentPane.jsx` -> `TabContentPane.tsx`
  4. `TitleBar.jsx` -> `TitleBar.tsx`
  5. `WorkspaceStat.tsx` (verified intact)
- **All Old `.jsx` Files Removed**:
  - Deleted `Welcome.jsx`, `CommandPalette.jsx`, `PreviewCommandPalette.jsx`, `Preview.jsx`, `Profile.jsx`, `StatusBar.jsx`, `TabBar.jsx`, `TabContentPane.jsx`, and `TitleBar.jsx`.
- **Architectural Barrels Created**:
  - `src/renderer/src/features/commandpalette/index.ts`
  - `src/renderer/src/features/preview/index.ts`
  - `src/renderer/src/features/profile/index.ts`
  - `src/renderer/src/features/Layout/index.ts`

## 7. Active Line Left Border: Theme Decoupling & 1px Width (Fixed)
- **Root Cause**: Hardcoded theme overrides in `Editor.css` (`[data-theme='dark']`, `[data-theme='obsidian-robust']`, `[data-theme='light']`) forced active line box-shadows on specific themes and used a 2px border width.
- **Resolution**:
  - Removed all theme-specific active-line CSS overrides.
  - Active line left border is now controlled exclusively via the Settings toggle (`Active Line Left Border` / `data-use-active-line-border="true"`).
  - Width is strictly enforced to `1px` across all themes. When toggled off, `border-left` and `box-shadow` are completely disabled (`none !important`).