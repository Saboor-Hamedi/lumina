const jsdom = require('jsdom')
const { JSDOM } = jsdom
const dom = new JSDOM(
  <style>
    table { table-layout: fixed; width: max-content; }
    th { width: 100px; min-width: 100px; max-width: 100px; }
  </style>
  <table>
    <tr><th>A</th><th>B</th></tr>
    <tr><td>1</td><td>2</td></tr>
  </table>
")
const table = dom.window.document.querySelector('table')
console.log('Table layout:', dom.window.getComputedStyle(table).tableLayout)
