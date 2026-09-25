VS Code's file explorer uses a **virtualized tree renderer** (its own List/Tree widget, not the DOM holding every node). Key mechanisms:

- **Virtual rendering**: Only visible rows get real DOM nodes. Collapsing a folder just removes its children from the *visible row list* — it doesn't destroy/recreate DOM for the whole subtree, so it's cheap regardless of how many files are inside.
- **Lazy model**: The tree model keeps folder state (expanded/collapsed) as metadata, not by walking the filesystem again. Collapsing is an O(visible rows) UI operation, not an FS operation.
- **Async/deferred children**: Subfolders aren't scanned until expanded (lazy loading), so a huge collapsed folder costs almost nothing until you open it.
- **Diffing on refresh**: When the underlying data changes, VS Code diffes old vs. new tree state rather than re-rendering everything.

Net effect: collapse/expand feels O(1)-ish to the user because the heavy part (DOM size) is capped by viewport height, not total file count.


Yes — confirmed, with the core points holding up:

VS Code's workbench uses tree widgets that extend base tree implementations with workbench-integrated functionality like context menus, focus handling, and theming, serving as the primary components for file explorers, debug views, and search results. This is the AsyncDataTree/ObjectTree machinery I mentioned. 
boriel
Lazy/async children loading is real and standard practice for this pattern: expanding a folder fires a listChildren call, and collapsing mid-load can abort the in-flight request via an AbortSignal — this is the general model VS Code's own explorer follows (children aren't fetched until you expand). 
grida
The broader principle — only rendering visible rows, loading children on demand rather than eagerly walking the whole tree — is the standard "virtual treeview" approach used to keep UI threads from locking up on large trees, which is exactly the pattern VS Code's explorer is built on.

So my original explanation was directionally accurate. The one thing I'd flag as slightly hand-wavy: I can't independently verify the exact internal class names (ObjectTree, diffing implementation details) from these sources — that part I'm relying on general knowledge of VS Code's open-source codebase rather than a freshly-verified source just now. If you want, I can dig into the actual vscode/src/vs/base/browser/ui/tree source on GitHub to confirm specifics.