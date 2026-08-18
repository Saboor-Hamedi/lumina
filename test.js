
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const dom = new JSDOM(`
  <div class="cm-atomic-table-cell-source">
    <span class="cm-strong">
      <span class="cm-atomic-mark">**</span>
      <span class="cm-atomic-image-wrap">
        <span class="cm-atomic-mark">![alt](url)</span>
      </span>
      <span class="cm-atomic-mark">**</span>
    </span>
  </div>
`)
const document = dom.window.document
const sourceEl = document.querySelector(".cm-atomic-table-cell-source")
const markSpan = document.querySelector(".cm-atomic-image-wrap .cm-atomic-mark")

markSpan.textContent = ""
let text = ""
for (const child of sourceEl.childNodes) {
  if (child.nodeType === 3) text += child.nodeValue
  else if (child.classList && child.classList.contains("cm-atomic-image-wrap")) {
    const mark = child.querySelector(".cm-atomic-mark")
    if (mark) text += mark.textContent
  } else {
    text += child.textContent
  }
}
console.log(text.trim())

