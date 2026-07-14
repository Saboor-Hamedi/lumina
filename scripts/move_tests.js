const fs = require('fs');
const path = require('path');

const srcDir = path.join('b:', 'electron', 'lumina', 'src');
const destDir = path.join('b:', 'electron', 'lumina', 'test');

const testFiles = [
  'src/main/VaultManager.test.js',
  'src/main/VaultSearch.test.js',
  'src/renderer/src/components/atoms/Button.test.jsx',
  'src/renderer/src/core/hooks/stringUtils.test.js',
  'src/renderer/src/core/hooks/useTheme.test.jsx',
  'src/renderer/src/core/hooks/useToast.test.js',
  'src/renderer/src/core/notification/ToastNotification.test.jsx',
  'src/renderer/src/core/store/useSettingsStore.test.js',
  'src/renderer/src/core/store/useUpdateStore.test.js',
  'src/renderer/src/core/store/useVaultStore.test.js',
  'src/renderer/src/core/utils/graphBuilder.test.js',
  'src/renderer/src/features/AI/LuminaChat.test.js'
];

for (const relPath of testFiles) {
  const oldPath = path.resolve('b:/electron/lumina', relPath);
  const newRelPath = relPath.replace(/^src[\\\/]/, ''); 
  const newPath = path.resolve(destDir, newRelPath);
  
  fs.mkdirSync(path.dirname(newPath), { recursive: true });

  let content = fs.readFileSync(oldPath, 'utf8');

  const importRegex = /(from\s+['"]|require\(['"]|vi\.mock\(['"])([^'"]+)(['"]\)?)/g;
  
  content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    if (importPath.startsWith('.')) {
      const absoluteImportedPath = path.resolve(path.dirname(oldPath), importPath);
      let newRelativeImport = path.relative(path.dirname(newPath), absoluteImportedPath);
      if (!newRelativeImport.startsWith('.')) {
        newRelativeImport = './' + newRelativeImport;
      }
      newRelativeImport = newRelativeImport.replace(/\\/g, '/');
      return `${prefix}${newRelativeImport}${suffix}`;
    }
    return match;
  });

  fs.writeFileSync(newPath, content);
  console.log(`Moved & updated: ${newPath}`);
  
  fs.unlinkSync(oldPath);
}
console.log('All test files moved and updated.');
