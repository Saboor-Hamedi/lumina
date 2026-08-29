The previous UI updates were not applied. Please directly update the components and CSS styles according to these exact instructions:

### 1. Global Typography (Remove Serif completely)
* Inspect the font family applied to `h1`, `h2`, `h3`, `.editor-title`, `.heading`, etc.
* Set all headings across the entire application to modern sans-serif:
  ```css
  h1, h2, h3, h4, h5, h6, .title, .editor-header {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif !important;
    letter-spacing: -0.02em;
  }