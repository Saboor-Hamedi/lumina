/**
 * E2E: Sidebar Resizer Drag Isolation
 *
 * Regression test: dragging the right-sidebar resizer knob must not affect
 * the left sidebar (and vice versa). Both knobs shared selectors in
 * mainlayout.css which made them glow/resize together; pointer-events and
 * the side-specific is-resizing classes keep them isolated now.
 */

const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs/promises')
const { launchApp } = require('./helpers/launch')

let app, page, vaultPath, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  vaultPath = launched.vaultPath
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  if (typeof cleanup === 'function') await cleanup()
})

async function writeNote(vaultDir, title, data) {
  const filePath = path.join(vaultDir, `${title}.md`)
  const raw = `---
id: ${data.id}
title: ${title}
language: markdown
timestamp: ${Date.now()}
tags: ''
---

${data.content || 'Test content'}`
  await fs.writeFile(filePath, raw, 'utf8')
  return filePath
}

const readWidths = () =>
  page.evaluate(() => {
    const shellEl = document.querySelector('.app-shell')
    const left = getComputedStyle(shellEl).getPropertyValue('--left-sidebar-width').trim()
    const right = getComputedStyle(shellEl).getPropertyValue('--right-sidebar-width').trim()
    return { left, right }
  })

test('dragging the right resizer does not resize the left sidebar', async () => {
  await writeNote(vaultPath, 'Note A', { id: 'note-a' })

  const shell = page.locator('.app-shell')

  // Open the right (inspector) sidebar
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('toggle-inspector'))
  })
  await expect(shell).toHaveClass(/right-open/, { timeout: 5000 })

  const before = await readWidths()
  const startRight = parseInt(before.right, 10)

  const resizer = page.locator('.sidebar-resizer.right')
  const box = await resizer.boundingBox()
  expect(box).not.toBeNull()

  // Drag the right knob 50px to the LEFT (expands right sidebar only)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 50, box.y + box.height / 2, { steps: 12 })
  await expect(shell).toHaveClass(/is-resizing-right/)
  const during = await readWidths()
  expect(during.left).toBe(before.left)

  await page.mouse.up()
  await page.waitForTimeout(350)

  const after = await readWidths()
  expect(after.left).toBe(before.left)
  expect(parseInt(after.right, 10)).toBe(Math.round(startRight + 50))

  const bodyClasses = await page.evaluate(() => document.body.classList.toString())
  expect(bodyClasses).not.toContain('is-global-resizing')

  // Left knob remains fully usable after the right-drag ends
  const leftResizerBox = await page.locator('.sidebar-resizer.left').boundingBox()
  expect(leftResizerBox).not.toBeNull()
})

test('dragging the left resizer does not resize the right sidebar', async () => {
  await writeNote(vaultPath, 'Note B', { id: 'note-b' })

  const shell = page.locator('.app-shell')

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('toggle-inspector'))
  })
  await expect(shell).toHaveClass(/right-open/, { timeout: 5000 })

  const before = await readWidths()
  const startLeft = parseInt(before.left, 10)

  const resizer = page.locator('.sidebar-resizer.left')
  const box = await resizer.boundingBox()
  expect(box).not.toBeNull()

  // Drag the left knob 50px to the RIGHT (expands left sidebar only)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 12 })
  await expect(shell).toHaveClass(/is-resizing-left/)
  const during = await readWidths()
  expect(during.right).toBe(before.right)

  await page.mouse.up()
  await page.waitForTimeout(350)

  const after = await readWidths()
  expect(after.right).toBe(before.right)
  expect(parseInt(after.left, 10)).toBe(Math.round(startLeft + 50))
})
