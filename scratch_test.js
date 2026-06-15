const path = require('path');
const VaultManager = { vaultPath: 'C:\\Users\\Saboor\\OneDrive\\Documents\\lumina' };

const requestUrl = 'asset://local/.lumina/assets/1-1781419716559.png';
const parsedUrl = new URL(requestUrl);
const relativePath = decodeURIComponent(parsedUrl.pathname.slice(1));
const finalPath = path.join(VaultManager.vaultPath, relativePath);

console.log('parsedUrl:', parsedUrl);
console.log('relativePath:', relativePath);
console.log('finalPath:', finalPath);
