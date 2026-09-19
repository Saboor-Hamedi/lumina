import { describe, it, expect } from 'vitest'
import { isAsciiTree } from '../../../../../../src/renderer/src/features/AI/components/LuminaTreeBadge'

describe('LuminaTreeBadge & Tree Structure Detection', () => {
  it('correctly identifies ASCII folder trees', () => {
    const treeText = `Lumina Vault/
├── 01 Programming/
│   ├── Algorithms/
│   ├── Best Coding/
│   └── Prompt Engineering/
├── 02 Data & Databases/
│   ├── Data Science/
│   └── Pandas Advanced/
└── 03 AI & Knowledge/
    └── Machine Learning/`

    expect(isAsciiTree(treeText)).toBe(true)
  })

  it('rejects regular bash code or prose without tree branch characters', () => {
    const normalCode = `npm run dev
echo "Hello world"
ls -la`
    expect(isAsciiTree(normalCode)).toBe(false)

    const listText = `- Item 1
- Item 2
- Item 3`
    expect(isAsciiTree(listText)).toBe(false)
  })

  it('handles single line or empty input safely', () => {
    expect(isAsciiTree('')).toBe(false)
    expect(isAsciiTree(undefined as any)).toBe(false)
    expect(isAsciiTree('├── only one line')).toBe(false)
  })
})
