import { WidgetType } from '@codemirror/view'

/**
 * Renders a horizontal rule (<hr>)
 */
export class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-hr'
    return hr
  }
}

/**
 * Renders the header of a code block (Language label + Copy button)
 */
export class CodeBlockHeaderWidget extends WidgetType {
  constructor(lang, code) {
    super()
    this.lang = lang || 'text'
    this.code = code
  }
  
  eq(other) {
    return other.lang === this.lang && other.code === this.code
  }

  toDOM() {
    const wrap = document.createElement('div')
    wrap.className = 'cm-codeblock-header'
    
    const label = document.createElement('span')
    label.className = 'cm-lang-label'
    label.textContent = this.lang.toUpperCase()
    
    const copyBtn = document.createElement('button')
    copyBtn.className = 'cm-copy-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.title = "Copy Code"
    
    copyBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation() // Prevent cursor move
      navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = 'Copied!'
        setTimeout(() => copyBtn.textContent = 'Copy', 2000)
      })
    }
    
    wrap.appendChild(label)
    wrap.appendChild(copyBtn)
    return wrap
  }
}

/**
 * Renders the footer of a code block (Closing visual)
 */
export class CodeBlockFooterWidget extends WidgetType {
  toDOM() {
    const d = document.createElement('div')
    d.className = 'cm-codeblock-footer'
    return d
  }
}
