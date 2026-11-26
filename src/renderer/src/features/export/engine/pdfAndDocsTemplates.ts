import hljsLightCss from 'highlight.js/styles/github.min.css?raw'
import { escapeHtml, getPreviewPageChrome, SHARED_SCROLLBAR_CSS } from './types'

export function buildPDFDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = '',
  theme?: Record<string, string>
): string {
  const safeTitle = title || 'Untitled'
  const { stageBg, pageBorder, pageShadow } = getPreviewPageChrome(theme)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${hljsLightCss}
${SHARED_SCROLLBAR_CSS}
@page {
  size: A4;
  margin: 22mm 20mm 24mm 20mm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${stageBg}; }
body {
  font-family: 'Times New Roman', Times, serif;
  line-height: 1.5;
  color: #1e293b;
  font-size: 12pt;
  text-align: justify;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  padding: 32px 24px;
  min-height: 100vh;
}
.page {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  background: #ffffff;
  padding: 52px 60px 60px 60px;
  border-radius: 4px;
  border: 1px solid ${pageBorder};
  box-shadow: ${pageShadow};
}
@media print {
  html, body { background: #ffffff; }
  body { padding: 0; min-height: auto; }
  .page {
    width: auto;
    max-width: none;
    min-height: auto;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  font-weight: 700;
  line-height: 1.25;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 15pt; margin-top: 0; margin-bottom: 8pt; color: #0f172a; }
h2 { font-size: 12.5pt; margin: 14pt 0 6pt; color: #1e293b; }
h3, h4 { font-size: 11.5pt; margin: 11pt 0 5pt; color: #334155; }
p {
  margin: 6pt 0;
  color: #1e293b;
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  orphans: 3;
  widows: 3;
}
ul, ol { margin: 6pt 0 10pt; padding-left: 18pt; }
li { margin: 3pt 0; color: #1e293b; }
hr { border: none; height: 1px; background: #cbd5e1; margin: 14pt 0; }
a { color: #2563eb; text-decoration: none; }
code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 9.5pt;
  color: #be123c;
  background: transparent;
}
pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10pt 12pt;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  margin: 10pt 0;
  break-inside: auto;
}
pre code, pre code.hljs, .hljs {
  background: transparent !important;
  color: #1e293b;
  padding: 0;
  border: none;
  font-size: 9pt;
  line-height: 1.45;
}
blockquote {
  border-left: 2.5px solid #cbd5e1;
  padding: 2pt 0 2pt 12pt;
  margin: 8pt 0;
  color: #475569;
  font-style: italic;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt auto;
  font-size: 10pt;
  table-layout: fixed;
  word-break: break-word;
  border: 1px solid #94a3b8;
}
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td {
  border: 1px solid #cbd5e1;
  padding: 4pt 6pt;
  text-align: left;
  vertical-align: top;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
tbody tr:nth-child(even) { background: #f8fafc; }
img {
  display: block;
  max-width: 100%;
  max-height: 9.5cm;
  width: auto;
  height: auto;
  margin: 10pt auto;
  border-radius: 4px;
}
.mermaid { display: flex; justify-content: center; align-items: center; margin: 12pt 0; break-inside: avoid; }
.mermaid svg { max-width: 100% !important; max-height: 9.5cm !important; width: auto !important; height: auto !important; }
.mermaid-error {
  padding: 8pt 10pt;
  font-size: 9.5pt;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  text-align: center;
}
.wikilink { color: #1d4ed8; font-weight: 500; }
.math-block { margin: 10pt 0; text-align: center; }
.toc { margin: 0 0 16pt; }
.toc-title {
  font-size: 13pt;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 6pt;
  padding-bottom: 3pt;
  border-bottom: 1px solid #cbd5e1;
}
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 2pt 0; font-size: 10.5pt; }
.toc-l2 { padding-left: 14pt; }
.toc-l3 { padding-left: 28pt; font-size: 10pt; }
.note-divider {
  border: none;
  border-top: 1px dashed #cbd5e1;
  margin: 22pt 0;
  page-break-before: auto;
}
  </style>
</head>
<body>
  <div class="page">
    ${tocHtml ? `<div class="toc"><div class="toc-title">Table of Contents</div>${tocHtml}</div>` : ''}
    ${htmlBody}
  </div>
</body>
</html>`
}

export function buildDocsDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = '',
  isPreview: boolean = false,
  theme?: Record<string, string>
): string {
  const safeTitle = title || 'Untitled'
  const { stageBg, pageBorder, pageShadow } = getPreviewPageChrome(theme)
  const docsBody = htmlBody
    .replace(/<blockquote\b[^>]*>/gi, '<div class="export-quote">')
    .replace(/<\/blockquote>/gi, '</div>')

  const wrapperStart = isPreview ? '<div class="page">' : '<div class="word-doc">'
  const wrapperEnd = '</div>'

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${hljsLightCss}
${isPreview ? SHARED_SCROLLBAR_CSS : ''}
@page { size: A4; margin: 25mm 22mm 26mm 22mm; }
html { background: ${isPreview ? stageBg : '#ffffff'}; }
body {
  font-family: 'Times New Roman', serif;
  line-height: 1.5;
  color: #1e293b;
  background: ${isPreview ? stageBg : '#ffffff'};
  padding: ${isPreview ? '32px 24px' : '0'};
  margin: 0;
  font-size: 12pt;
  text-align: justify;
}
${
  isPreview
    ? `.page {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  background: #ffffff;
  padding: 52px 60px 60px 60px;
  border-radius: 4px;
  border: 1px solid ${pageBorder};
  box-shadow: ${pageShadow};
}`
    : ''
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  font-family: 'Times New Roman', serif;
  margin-top: 12pt;
  margin-bottom: 6pt;
  font-weight: 700;
  line-height: 1.25;
  text-align: left;
}
h1 { margin-top: 0; font-size: 14pt; }
h2 { font-size: 12.5pt; }
h3, h4 { font-size: 12pt; color: #334155; }
p { margin: 6pt 0; color: #334155; text-align: justify; }
ul, ol { margin: 6pt 0 10pt; padding-left: 20pt; }
li { margin: 2pt 0; }
code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10pt;
  color: #be123c;
  background: transparent;
}
pre {
  background: #f8fafc;
  padding: 10pt 12pt;
  border: 1px solid #e2e8f0;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 10pt 0;
}
pre code, .hljs { background: transparent !important; color: #1e293b; padding: 0; }
.export-quote {
  border: none;
  padding: 0 0 0 12pt;
  margin: 6pt 0;
  color: #475569;
  font-style: italic;
}
table {
  border-collapse: collapse;
  margin: 12pt auto;
  width: 100%;
  table-layout: fixed;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
  font-size: 10pt;
  border: 1px solid #94a3b8;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 3pt 5pt;
  mso-padding-alt: 3pt 5pt 3pt 5pt;
  text-align: left;
  vertical-align: top;
  line-height: 1.2;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
th { background: #f1f5f9; font-weight: 700; }
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8pt auto;
}
.toc { margin: 0 0 14pt; }
.toc-title { font-size: 13pt; font-weight: 700; margin-bottom: 4pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; }
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 2pt 0; font-size: 10.5pt; }
.toc-l2 { padding-left: 14pt; }
.toc-l3 { padding-left: 28pt; }
  </style>
</head>
<body>
  ${wrapperStart}
    ${tocHtml ? `<div class="toc"><div class="toc-title">Table of Contents</div>${tocHtml}</div>` : ''}
    ${docsBody}
  ${wrapperEnd}
</body>
</html>`
}
