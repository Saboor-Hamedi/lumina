act(() => {
/* fire events that update state _/
});
/_ assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stderr | test/renderer/src/components/Version.test.jsx > Version > handles API rejection gracefully
Error: fail
at /Users/runner/work/lumina/lumina/test/renderer/src/components/Version.test.jsx:32:62
at file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:302:11
at file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:26
at file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:2326:20
at new Promise (<anonymous>)
at runWithCancel (file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:2323:10)
at file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:2305:20
at new Promise (<anonymous>)
at runWithTimeout (file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:2272:10)
at file:///Users/runner/work/lumina/lumina/node_modules/@vitest/runner/dist/chunk-artifact.js:2956:64

✓ test/renderer/src/components/Version.test.jsx (4 tests) 77ms
✓ test/renderer/src/features/Explorer/sortableListItemMemo.test.ts (3 tests) 4ms
✓ test/renderer/src/core/hooks/stringUtils.test.js (6 tests) 3ms
✓ test/renderer/src/features/Editor/menu/insertActions.test.js (3 tests) 6ms
✓ test/renderer/src/features/Editor/components/EditorZoomHud.test.tsx (3 tests) 54ms
Error: Not implemented: HTMLCanvasElement.prototype.getContext (without installing the canvas npm package)
at module.exports (/Users/runner/work/lumina/lumina/node_modules/jsdom/lib/jsdom/browser/not-implemented.js:9:17)
✓ test/renderer/src/core/terminal/useTerminalInstance.test.ts (1 test) 3ms
at HTMLCanvasElementImpl.getContext (/Users/runner/work/lumina/lumina/node_modules/jsdom/lib/jsdom/living/nodes/HTMLCanvasElement-impl.js:42:5)
at HTMLCanvasElement.getContext (/Users/runner/work/lumina/lumina/node_modules/jsdom/lib/jsdom/living/generated/HTMLCanvasElement.js:131:58)
at /Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:139326
at Object.4103 (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:140546)
at i (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:483379)
at Object.1433 (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:83991)
at i (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:483379)
at Object.3955 (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:71362)
at i (/Users/runner/work/lumina/lumina/node_modules/@xterm/xterm/lib/xterm.js:1:483379) undefined
✓ test/renderer/src/features/AI/tools/diagnoseSystem.test.ts (5 tests) 37ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

Test Files 3 failed | 167 passed (170)
FAIL test/main/workspaceManager.test.ts > VaultManager > path containment > rejects Alternate Data Streams in relative paths
Tests 6 failed | 1362 passed (1368)
AssertionError: promise resolved "null" instead of rejecting
Start at 03:53:53

Duration 57.12s (transform 4.59s, setup 14.32s, import 23.73s, tests 16.95s, environment 42.24s)

- Expected:

Error {

"message": "rejected promise",
Error: AssertionError: promise resolved "null" instead of rejecting

- Expected:
  Error {
  "message": "rejected promise",
  }

* Received:
  null

❯ test/main/workspaceManager.test.ts:450:7

}

- Received:
  null

❯ test/main/workspaceManager.test.ts:450:7
448| await expect(
449| VaultManager.readAsset('valid.png:hidden.exe')
450| ).rejects.toThrow(/Alternate Data Stream|Security Violation/i)
| ^
451| })
452|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

FAIL test/renderer/src/features/Docs/Documentation.test.jsx > Documentation Component Suite > Documentation.jsx Modal > renders modal header, title, and badges when open
FAIL test/renderer/src/features/Docs/Documentation.test.jsx > Documentation Component Suite > Documentation.jsx Modal > toggles sidebar on toggle button click
FAIL test/renderer/src/features/Docs/Documentation.test.jsx > Documentation Component Suite > Documentation.jsx Modal > toggles maximize window on window button click
FAIL test/renderer/src/features/Docs/Documentation.test.jsx > Documentation Component Suite > Documentation.jsx Modal > calls onClose when close button or overlay is clicked
FAIL test/renderer/src/features/template/Template.test.tsx > Template.jsx > navigates templates using arrow keys and applies with Enter
Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
112| highlightActiveLine(),
113| closeBrackets(),
114| extendEmphasisPair,
| ^
115| autoCloseCodeFence,
116| EditorView.lineWrapping,
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

Error: Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

Error: Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

Error: Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

Error: Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

Error: Error: [vitest] No "extendEmphasisPair" export is defined on the "@atomic-editor/editor" mock. Did you forget to return it from "vi.mock"?
If you need to partially mock a module, you can use "importOriginal" helper inside:

vi.mock(import("@atomic-editor/editor"), async (importOriginal) => {
const actual = await importOriginal()
return {
...actual,
// your mocked methods
}
})

❯ src/renderer/src/features/Editor/atomic/AtomicCodeMirrorEditor.tsx:114:11
❯ Object.react_stack_bottom_frame node_modules/react-dom/cjs/react-dom-client.development.js:28656:20
❯ runWithFiberInDEV node_modules/react-dom/cjs/react-dom-client.development.js:1048:13
❯ commitHookEffectListMount node_modules/react-dom/cjs/react-dom-client.development.js:13748:29
❯ commitHookPassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:13835:11
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:16906:13
❯ recursivelyTraversePassiveMountEffects node_modules/react-dom/cjs/react-dom-client.development.js:16851:13
❯ commitPassiveMountOnFiber node_modules/react-dom/cjs/react-dom-client.development.js:17183:11

Error: Process completed with exit code 1.
