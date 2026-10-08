import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imageJsPath = path.resolve(__dirname, '../node_modules/@xenova/transformers/src/utils/image.js')

if (fs.existsSync(imageJsPath)) {
  let content = fs.readFileSync(imageJsPath, 'utf8')
  if (content.includes("import sharp from 'sharp';")) {
    console.log('[ensure-transformers] Patching @xenova/transformers image.js for sharp compatibility...')
    content = content.replace(
      "import sharp from 'sharp';",
      `let sharp = null;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default || sharpMod;
} catch (e) {
  // sharp is optional; non-vision pipelines (text embeddings) run without native binary
}`
    )
    content = content.replace(
      "throw new Error('Unable to load image processing library.');",
      `loadImageFunction = async () => {
        throw new Error('Unable to load image processing library.');
    };`
    )
    fs.writeFileSync(imageJsPath, content, 'utf8')
    console.log('[ensure-transformers] Successfully patched!')
  }
}
