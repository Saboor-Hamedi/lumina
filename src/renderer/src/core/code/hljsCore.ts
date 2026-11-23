import type { LanguageFn } from 'highlight.js'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import java from 'highlight.js/lib/languages/java'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import less from 'highlight.js/lib/languages/less'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import ini from 'highlight.js/lib/languages/ini'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import shell from 'highlight.js/lib/languages/shell'
import powershell from 'highlight.js/lib/languages/powershell'
import dos from 'highlight.js/lib/languages/dos'
import markdown from 'highlight.js/lib/languages/markdown'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import graphql from 'highlight.js/lib/languages/graphql'
import diff from 'highlight.js/lib/languages/diff'
import makefile from 'highlight.js/lib/languages/makefile'
import lua from 'highlight.js/lib/languages/lua'
import r from 'highlight.js/lib/languages/r'
import dart from 'highlight.js/lib/languages/dart'
import latex from 'highlight.js/lib/languages/latex'
import plaintext from 'highlight.js/lib/languages/plaintext'

type CuratedLanguageEntry =
  | readonly [string, LanguageFn]
  | readonly [string, LanguageFn, readonly string[]]

const CURATED_LANGUAGES: ReadonlyArray<CuratedLanguageEntry> = [
  ['javascript', javascript, ['js', 'jsx', 'mjs', 'cjs']],
  ['typescript', typescript, ['ts', 'tsx', 'mts', 'cts']],
  ['python', python, ['py']],
  ['rust', rust, ['rs']],
  ['go', go, ['golang']],
  ['c', c, ['h']],
  ['cpp', cpp, ['cc', 'cxx', 'hpp', 'hh', 'hxx']],
  ['csharp', csharp, ['cs', 'c#']],
  ['java', java],
  ['kotlin', kotlin, ['kt', 'kts']],
  ['swift', swift],
  ['php', php],
  ['ruby', ruby, ['rb']],
  ['xml', xml, ['html', 'htm', 'xhtml', 'svg', 'vue', 'svelte']],
  ['css', css],
  ['scss', scss],
  ['less', less],
  ['json', json],
  ['yaml', yaml, ['yml']],
  ['ini', ini, ['toml', 'cfg', 'conf']],
  ['sql', sql],
  ['bash', bash, ['sh', 'zsh']],
  ['shell', shell],
  ['powershell', powershell, ['ps', 'ps1', 'pwsh']],
  ['dos', dos, ['bat', 'cmd']],
  ['markdown', markdown, ['md', 'mdx', 'mkdown', 'mkd']],
  ['dockerfile', dockerfile, ['docker']],
  ['graphql', graphql, ['gql']],
  ['diff', diff, ['patch']],
  ['makefile', makefile, ['mk', 'mak']],
  ['lua', lua],
  ['r', r],
  ['dart', dart],
  ['latex', latex, ['tex']],
  ['plaintext', plaintext, ['txt', 'text']]
]

for (const [name, languageDef, aliases] of CURATED_LANGUAGES) {
  if (!hljs.getLanguage(name)) {
    hljs.registerLanguage(name, languageDef)
  }
  if (aliases && aliases.length > 0) {
    hljs.registerAliases([...aliases], { languageName: name })
  }
}

export { hljs }
export default hljs
