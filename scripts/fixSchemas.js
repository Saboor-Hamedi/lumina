const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '../src/renderer/src/features/AI/tools')
const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      f.endsWith('.js') &&
      f !== 'index.js' &&
      f !== 'bulkExecutor.js' &&
      f !== 'executeBulkPlan.js' &&
      f !== 'LuminaChat.js'
  )

for (const file of files) {
  const filePath = path.join(dir, file)
  let content = fs.readFileSync(filePath, 'utf8')

  if (content.includes('aiSdk.jsonSchema(')) {
    // We want to replace `parameters: aiSdk.jsonSchema({ ... })` or `inputSchema: aiSdk.jsonSchema({ ... })`
    // with `parameters: z.object({ ... })`

    // Find everything from `aiSdk.jsonSchema({` to its closing `})`
    const startIndex = content.indexOf('aiSdk.jsonSchema(')
    let braceCount = 0
    let inBraces = false
    let endIndex = startIndex
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        inBraces = true
        braceCount++
      } else if (content[i] === '}') {
        braceCount--
        if (inBraces && braceCount === 0) {
          // This is the closing brace of the JSON schema object.
          // Wait, aiSdk.jsonSchema({ ... }) so we need to find the closing paren.
          if (content[i + 1] === ')') {
            endIndex = i + 1
          } else {
            // there might be spaces or newlines
            let j = i + 1
            while (content[j] === ' ' || content[j] === '\n' || content[j] === '\r') j++
            if (content[j] === ')') endIndex = j
          }
          break
        }
      }
    }

    const schemaStr = content.substring(startIndex + 'aiSdk.jsonSchema('.length, endIndex)
    // schemaStr is `{ type: 'object', properties: { ... }, required: [...] }`
    // Let's parse it if possible, but it might not be valid JSON (might be JS object).
    // Let's just use regex to extract properties.
    const propMatch = schemaStr.match(
      /properties:\s*\{([\s\S]*?)\}\s*(?:,\s*required:\s*\[(.*?)\])?/
    )
    if (propMatch) {
      const propsStr = propMatch[1]
      const reqStr = propMatch[2] || ''
      const required = reqStr
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter(Boolean)

      const newProps = []
      const lines = propsStr.split('\n')
      for (const line of lines) {
        const m = line.match(
          /^\s*([a-zA-Z0-9_]+)\s*:\s*\{\s*type:\s*['"]([a-zA-Z]+)['"],\s*description:\s*['"](.*?)['"]\s*\}/
        )
        if (m) {
          const propName = m[1]
          const type = m[2]
          const desc = m[3]
          const isReq = required.includes(propName)
          let zType =
            type === 'string'
              ? 'z.string()'
              : type === 'number'
                ? 'z.number()'
                : type === 'boolean'
                  ? 'z.boolean()'
                  : 'z.any()'
          newProps.push(
            `      ${propName}: ${zType}.describe('${desc.replace(/'/g, "\\'")}')${isReq ? '' : '.optional()'}`
          )
        }
      }

      const zodReplacement = `z.object({\n${newProps.join(',\n')}\n    })`

      // Also we need to make sure the key is `parameters` and not `inputSchema`
      let before = content.substring(0, startIndex)
      before = before.replace(/(parameters|inputSchema):\s*$/, 'parameters: ')
      const after = content.substring(endIndex + 1) // skip ')'

      content = before + zodReplacement + after
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`Successfully replaced schema in ${file}`)
    } else {
      console.log(`Failed to match properties in ${file}`)
    }
  }
}
