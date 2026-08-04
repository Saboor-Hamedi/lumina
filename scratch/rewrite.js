const fs = require('fs')
const path = require('path')
const toolsDir = path.join(__dirname, 'src', 'renderer', 'src', 'features', 'AI', 'tools')

const files = fs
  .readdirSync(toolsDir)
  .filter(
    (f) =>
      f.endsWith('.js') &&
      !f.includes('index') &&
      !f.includes('LuminaChat') &&
      !f.includes('bulk') &&
      !f.includes('executeBulkPlan')
  )

// Also include executeBulkPlan
files.push('executeBulkPlan.js')

files.forEach((f) => {
  const filePath = path.join(toolsDir, f)
  let content = fs.readFileSync(filePath, 'utf8')

  // Let's print out what we need to replace so we can do it manually or via regex
  console.log('--- ' + f + ' ---')
  // Just print the parameters block
  const match = content.match(/parameters:\s*z\.object\([\s\S]*?\),/)
  if (match) {
    console.log(match[0])
  }
})
