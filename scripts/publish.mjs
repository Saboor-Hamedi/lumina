import { execSync } from 'child_process'
import fs from 'fs'

try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const version = pkg.version
  const tagName = `v${version}`

  console.log(`\n🚀 Lumina CI/CD Release Trigger`)
  console.log(`──────────────────────────────────────────`)
  console.log(`Version: ${version}`)
  console.log(`Tag:     ${tagName}\n`)

  let tagExists = false
  try {
    const existingTags = execSync('git tag', { encoding: 'utf8' })
    if (existingTags.split('\n').map((t) => t.trim()).includes(tagName)) {
      tagExists = true
    }
  } catch (_) {}

  if (!tagExists) {
    console.log(`📌 Creating Git tag: ${tagName}`)
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' })
  } else {
    console.log(`ℹ️ Git tag ${tagName} already exists. Updating tag to current commit...`)
    execSync(`git tag -f -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' })
  }

  console.log(`📤 Pushing ${tagName} to GitHub...`)
  execSync(`git push origin ${tagName} --force`, { stdio: 'inherit' })

  console.log(`\n✅ CI/CD Pipeline Triggered Successfully!`)
  console.log(`──────────────────────────────────────────`)
  console.log(`🌐 GitHub Actions is now building in parallel:`)
  console.log(`   • Windows Installer (.exe)`)
  console.log(`   • macOS Disk Image (.dmg)`)
  console.log(`   • Linux Package (.AppImage / .deb)\n`)
} catch (err) {
  console.error('\n❌ Release trigger failed:', err.message)
  process.exit(1)
}
