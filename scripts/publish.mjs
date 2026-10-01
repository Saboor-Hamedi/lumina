import { execSync } from 'child_process'
import fs from 'fs'

try {
  const pkgPath = 'package.json'
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  let version = pkg.version

  // Check if a specific version or bump argument was passed (e.g., "patch", "minor", "1.0.66")
  const arg = process.argv[2]?.trim()

  const existingTags = (() => {
    try {
      return execSync('git tag', { encoding: 'utf8' })
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
    } catch {
      return []
    }
  })()

  // Function to bump semver patch
  const bumpPatch = (v) => {
    const parts = v.split('.').map(Number)
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      parts[2] += 1
      return parts.join('.')
    }
    return v
  }

  const bumpMinor = (v) => {
    const parts = v.split('.').map(Number)
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      parts[1] += 1
      parts[2] = 0
      return parts.join('.')
    }
    return v
  }

  let shouldBump = false
  if (arg === 'patch') {
    version = bumpPatch(version)
    shouldBump = true
  } else if (arg === 'minor') {
    version = bumpMinor(version)
    shouldBump = true
  } else if (arg && /^\d+\.\d+\.\d+/.test(arg)) {
    version = arg.replace(/^v/, '')
    shouldBump = true
  } else if (existingTags.includes(`v${version}`)) {
    // Current version tag already exists - automatically bump patch so a new release is generated
    version = bumpPatch(version)
    shouldBump = true
    console.log(`ℹ️ Tag v${pkg.version} already exists. Auto-incrementing to v${version}...`)
  }

  if (shouldBump) {
    pkg.version = version
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
    console.log(`📦 Updated package.json version to ${version}`)
  }

  const tagName = `v${version}`

  console.log(`\n🚀 Lumina Automated Release Pipeline`)
  console.log(`──────────────────────────────────────────`)
  console.log(`Version: ${version}`)
  console.log(`Tag:     ${tagName}\n`)

  // Stage and commit all uncommitted changes including the version bump
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
  if (status) {
    console.log(`📝 Staging and committing changes for ${tagName}...`)
    execSync('git add -A', { stdio: 'inherit' })
    execSync(`git commit -m "chore(release): ${tagName}"`, { stdio: 'inherit' })
  }

  console.log(`📤 Pushing branch commits to origin...`)
  try {
    execSync('git push origin HEAD', { stdio: 'inherit' })
  } catch {
    execSync('git push', { stdio: 'inherit' })
  }

  console.log(`📌 Tagging commit as ${tagName}...`)
  execSync(`git tag -f -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' })

  console.log(`📤 Pushing tag ${tagName} to GitHub...`)
  execSync(`git push origin ${tagName} --force`, { stdio: 'inherit' })

  console.log(`\n✅ Release Successfully Triggered!`)
  console.log(`──────────────────────────────────────────`)
  console.log(`🌐 GitHub Actions is now automatically:`)
  console.log(`   1. Running all automated unit & integration tests`)
  console.log(`   2. Compiling Windows (.exe), macOS (.dmg), & Linux (.AppImage)`)
  console.log(`   3. Publishing the final release live to GitHub (No manual steps needed!)\n`)
} catch (err) {
  console.error('\n❌ Release trigger failed:', err.message)
  process.exit(1)
}
