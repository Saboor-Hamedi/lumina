const jsdom = require('jsdom')
const { JSDOM } = jsdom
const dom = new JSDOM(
  <style>
    .cm-atomic-table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid black; padding: 10px; position: relative; }
    .col-resizer { position: absolute; right: -3px; top: 0; width: 6px; height: 100%; cursor: col-resize; background: red; z-index: 10; }
  </style>
  <div class="cm-atomic-table">
    <table>
      <tr><th>A</th><th>B</th></tr>
      <tr><td>1</td><td>2</td></tr>
    </table>
  </div>
")
const document = dom.window.document
const table = document.querySelector('table')
const cells = Array.from(table.querySelectorAll('th, td'))
for (let i = 0; i < cells.length; i++) {
  const cell = cells[i]
  const resizer = document.createElement('div')
  resizer.className = 'col-resizer'
  cell.appendChild(resizer)
}
console.log('Resizers added:', document.querySelectorAll('.col-resizer').length)
