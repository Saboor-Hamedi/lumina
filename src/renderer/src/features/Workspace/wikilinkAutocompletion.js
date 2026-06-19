import { useVaultStore } from '../../core/store/useVaultStore'

const fuzzyMatch = (str, query) => {
  let i = 0, j = 0
  const lowerStr = str.toLowerCase()
  while (i < lowerStr.length && j < query.length) {
    if (lowerStr[i] === query[j]) j++
    i++
  }
  return j === query.length
}

export class TableAutocomplete {
  constructor(source, cell, commit, getCaretCharOffset, setCaretCharOffset) {
    this.source = source
    this.cell = cell
    this.commit = commit
    this.getCaretCharOffset = getCaretCharOffset
    this.setCaretCharOffset = setCaretCharOffset

    this.activeDropdown = null
    this.autocompleteMatches = []
    this.autocompleteIndex = 0
    this.currentQuery = ''
    this.lastOffset = null
  }

  close() {
    if (this.activeDropdown) {
      this.activeDropdown.remove()
      this.activeDropdown = null
    }
    this.autocompleteMatches = []
    this.autocompleteIndex = 0
  }

  isOpen() {
    return this.activeDropdown !== null
  }

  render() {
    if (!this.activeDropdown) return

    // Clear the dropdown to rebuild the list with new search results
    this.activeDropdown.innerHTML = ''

    const ul = document.createElement('ul')
    ul.setAttribute('role', 'listbox')
    ul.style.listStyle = 'none'
    ul.style.margin = '0'
    ul.style.padding = '0'

    this.autocompleteMatches.forEach((m, idx) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      if (idx === this.autocompleteIndex) {
        li.setAttribute('aria-selected', 'true')
      }

      const label = document.createElement('div')
      label.className = 'cm-completionLabel'
      label.textContent = m.title
      label.style.overflow = 'hidden'
      label.style.textOverflow = 'ellipsis'
      label.style.whiteSpace = 'nowrap'
      label.style.flex = '1'

      const detail = document.createElement('div')
      detail.className = 'cm-completionDetail'
      detail.textContent = 'Link to note'
      detail.style.flexShrink = '0'

      li.style.display = 'flex'
      li.style.justifyContent = 'space-between'
      li.style.alignItems = 'center'
      li.style.overflow = 'hidden'

      li.appendChild(label)
      li.appendChild(detail)

      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.apply(m.title)
      })

      ul.appendChild(li)
    })
    this.activeDropdown.appendChild(ul)

    const lis = this.activeDropdown.querySelectorAll('li')
    if (lis[this.autocompleteIndex]) {
      lis[this.autocompleteIndex].scrollIntoView({ block: 'nearest' })
    }
  }

  apply(title) {
    const fullText = this.source.textContent
    const offset = this.lastOffset !== null ? this.lastOffset : this.getCaretCharOffset(this.source)
    if (offset === null || offset === undefined) return

    const newText =
      fullText.substring(0, offset - this.currentQuery.length) +
      title +
      ']]' +
      fullText.substring(offset)
    this.source.textContent = newText
    this.setCaretCharOffset(this.source, offset - this.currentQuery.length + title.length + 2)
    this.commit()
    this.close()
  }

  handleInput() {
    const text = this.source.textContent || ''
    const offset = this.getCaretCharOffset(this.source)
    if (offset === null) {
      this.close()
      return
    }
    this.lastOffset = offset

    const beforeCaret = text.substring(0, offset)
    const match = /\[\[([^\]]*)$/.exec(beforeCaret)

    if (!match) {
      this.close()
      return
    }

    this.currentQuery = match[1]
    const query = this.currentQuery.toLowerCase()
    const snippets = useVaultStore.getState().snippets || []
    
    this.autocompleteMatches = snippets
      .filter(s => s.title && fuzzyMatch(s.title, query))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 8)

    if (this.autocompleteMatches.length === 0) {
      this.close()
      return
    }

    if (!this.activeDropdown) {
      this.activeDropdown = document.createElement('div')
      this.activeDropdown.className = 'cm-tooltip cm-tooltip-autocomplete'
      this.activeDropdown.style.position = 'absolute'
      this.activeDropdown.style.top = '100%'
      this.activeDropdown.style.left = '0'
      this.activeDropdown.style.zIndex = '99999'
      this.activeDropdown.style.overflowY = 'auto'
      this.activeDropdown.style.overflowX = 'hidden'
      this.activeDropdown.style.minWidth = '250px'
      this.activeDropdown.style.maxWidth = '400px'
      
      this.cell.style.position = 'relative'
      this.cell.appendChild(this.activeDropdown)
      this.autocompleteIndex = 0
    } else if (this.autocompleteIndex >= this.autocompleteMatches.length) {
      this.autocompleteIndex = Math.max(0, this.autocompleteMatches.length - 1)
    }

    this.render()
  }

  handleKeyDown(event) {
    if (!this.activeDropdown) return false

    if (event.key === 'Escape') {
      this.close()
      return true
    } else if (event.key === 'ArrowDown') {
      this.autocompleteIndex = (this.autocompleteIndex + 1) % this.autocompleteMatches.length
      this.render()
      return true
    } else if (event.key === 'ArrowUp') {
      this.autocompleteIndex = (this.autocompleteIndex - 1 + this.autocompleteMatches.length) % this.autocompleteMatches.length
      this.render()
      return true
    } else if (event.key === 'Enter') {
      this.apply(this.autocompleteMatches[this.autocompleteIndex].title)
      return true
    }
    return false
  }
}
