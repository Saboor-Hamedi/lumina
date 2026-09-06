[WorkspaceSearch] Failed to load index: SyntaxError: Unterminated string in JSON at position 1154 (line 1 column 1155)
    at JSON.parse (<anonymous>)
    at B:\electron\lumina\out\main\index.js:2182:96
    at Array.map (<anonymous>)
    at WorkspaceSearch.loadIndex (B:\electron\lumina\out\main\index.js:2182:77)
    at async WorkspaceSearch.reload (B:\electron\lumina\out\main\index.js:2200:5)
    at async B:\electron\lumina\out\main\index.js:4020:7
    at async Session.<anonymous> (node:electron/js2c/browser_init:2:107280)
[WorkspaceSearch] ✓ Loaded 731 chunks into memory
[WorkspaceSearch] ✓ Loaded 731 chunks into memory
[WorkspaceSearch] ✓ Loaded 731 chunks into memory
[WorkspaceSearch] ✓ Loaded 731 chunks into memory
[WorkspaceSearch] ✓ Loaded 731 chunks into memory
[WorkspaceScanner] ✗ Error scanning workspace: Error: ENOENT: no such file or directory, scandir 'C:\Users\Saboor\OneDrive\Documents\lumina\story'
    at async readdir (node:internal/fs/promises:957:18)
    at async walk (B:\electron\lumina\out\main\index.js:101:25)
    at async walk (B:\electron\lumina\out\main\index.js:109:13)
    at async WorkspaceScanner.scan (B:\electron\lumina\out\main\index.js:120:7)
    at async WorkspaceManager.scanVault (B:\electron\lumina\out\main\index.js:885:37)
    at async WorkspaceManager.deleteFolder (B:\electron\lumina\out\main\index.js:964:7)
    at async B:\electron\lumina\out\main\index.js:4017:20
    at async Session.<anonymous> (node:electron/js2c/browser_init:2:107280) {
  errno: -4058,
  code: 'ENOENT',
  syscall: 'scandir',
  path: 'C:\\Users\\Saboor\\OneDrive\\Documents\\lumina\\story'
}