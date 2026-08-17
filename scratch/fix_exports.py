import os
import re

scratch_dir = r'b:\electron\lumina\scratch'
src_dir = r'b:\electron\lumina\src\renderer\src\features\table'

files = ['tableModel.js', 'tableInlineParsing.js', 'tableCellDom.js', 'tableWidgetExtension.js']

contents = {}
for f in files:
    with open(os.path.join(scratch_dir, f), 'r', encoding='utf-8') as file:
        contents[f] = file.read()

# Add export to top-level functions/classes
def add_exports(content):
    lines = content.split('\n')
    for i in range(len(lines)):
        # If it starts with function, class, or const and not already exported
        m = re.match(r'^(function|class|const) ([a-zA-Z0-9_]+)', lines[i])
        if m:
            lines[i] = 'export ' + lines[i]
    return '\n'.join(lines)

for f in files:
    contents[f] = add_exports(contents[f])

# Collect all exports
file_exports = {}
for f in files:
    exports = []
    for line in contents[f].split('\n'):
        m = re.match(r'^export (?:function|class|const) ([a-zA-Z0-9_]+)', line)
        if m:
            exports.append(m.group(1))
    file_exports[f] = exports

# Standard imports for tableWidgetExtension.js and others
standard_imports = """import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, WidgetType, keymap, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, Facet } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'
import { treeGrowthEffect, treeProgressPlugin } from './tree-progress'
import { useVaultStore } from '../../core/store/useVaultStore'
import { TableAutocomplete } from './wikilinkAutocompletion'
import { setupTableFormattingToolbar } from './tableFormattingToolbar'
import { openCellMenu } from './tableContextMenu'
import { setupTableSelection } from './tableGridSelection'
import icons from './icons'
"""

# Link them
for f in files:
    final_content = standard_imports + '\n'
    
    for other_f in files:
        if f == other_f: continue
        
        used_exports = []
        for exp in file_exports[other_f]:
            if re.search(r'\b' + exp + r'\b', contents[f]):
                used_exports.append(exp)
                
        if used_exports:
            final_content += f"import {{ {', '.join(used_exports)} }} from './{other_f.replace('.js', '')}'\n"
            
    final_content += '\n' + contents[f]
    
    with open(os.path.join(src_dir, f), 'w', encoding='utf-8') as out:
        out.write(final_content)

print("Rewrite complete!")
