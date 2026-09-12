import { describe, it, expect } from 'vitest'
import { parseTable, serializeTable, readModelFromDom } from '../../../../../src/renderer/src/features/table/tableModel.js'

describe('tableModel.js column widths handling', () => {
  it('serializes column widths into HTML comments', () => {
    const model = {
      header: ['Name', 'Age'],
      rows: [['Alice', '30']],
      alignments: ['', ''],
      caption: '',
      columnWidths: [180, 220],
      rowHeights: []
    }
    const output = serializeTable(model)
    expect(output).toContain('<!-- table-widths: 180, 220 -->')
    expect(output).toContain('| Name | Age |')
  })

  it('reads column widths from DOM dataset and fallbacks accurately', () => {
    const wrap = document.createElement('div')
    wrap.dataset.columnWidths = '180,220'

    const table = document.createElement('table')
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')

    const th1 = document.createElement('th')
    th1.dataset.raw = 'Name'
    const th2 = document.createElement('th')
    th2.dataset.raw = 'Age'

    tr.appendChild(th1)
    tr.appendChild(th2)
    thead.appendChild(tr)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    table.appendChild(tbody)
    wrap.appendChild(table)

    const model = readModelFromDom(wrap)
    expect(model.columnWidths).toEqual([180, 220])
  })
})
