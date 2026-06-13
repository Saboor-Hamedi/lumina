   at async VaultManager.scanVault (B:\electron\lumina\out\main\index.js:76:30)
    at async FSWatcher.<anonymous> (B:\electron\lumina\out\main\index.js:60:9) {
  errno: -4066,
  code: 'EMFILE',
  syscall: 'open',
  path: 'C:\\Users\\Saboor\\OneDrive\\Documents\\lumina\\JSON Web Tokens.md'
}
[VaultManager] ✗ Failed to read file LLM Agents Framework.md: Error: EMFILE: too many open files, open 'C:\Users\Saboor\OneDrive\Documents\lumina\LLM Agents Framework.md'
    at async open (node:internal/fs/promises:641:25)
    at async Object.readFile (node:internal/fs/promises:1245:14)
    at async B:\electron\lumina\out\main\index.js:80:32
    at async Promise.all (index 17)
    at async VaultManager.scanVault (B:\electron\lumina\out\main\index.js:76:30)
    at async FSWatcher.<anonymous> (B:\electron\lumina\out\main\index.js:60:9) {
  errno: -4066,
  code: 'EMFILE',
  syscall: 'open',
  path: 'C:\\Users\\Saboor\\OneDrive\\Documents\\lumina\\LLM Agents Framework.md'