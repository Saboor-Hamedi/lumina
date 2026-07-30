const fs = require('fs');
const path = require('path');
const toolsDir = 'b:/electron/lumina/src/renderer/src/features/AI/tools';

const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.js') && !f.includes('index') && !f.includes('LuminaChat') && !f.includes('bulk'));
files.push('executeBulkPlan.js');

const schemas = {
  'createFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title (single word, no extension)' },
      content: { type: 'string', description: 'Full markdown content' },
      folder: { type: 'string', description: 'Optional. The existing folder path to create the file in (e.g., "English"). If root, leave undefined.' }
    },
    required: ['title', 'content']
  }`,
  'executeBulkPlan.js': `{
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'A brief summary of what this bulk operation achieves' },
      tasks: {
        type: 'array',
        description: 'The list of tasks to execute',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'A unique sequential ID for this task (1, 2, 3...)' },
            label: { type: 'string', description: 'A short, user-friendly label for this task' },
            tool: { type: 'string', enum: ['createFile', 'updateFile', 'appendToFile', 'deleteFile', 'renameFile', 'moveFile'], description: 'The file operation to perform' },
            title: { type: 'string', description: 'The title of the file to operate on. Use kebab-case and NO extension.' },
            description: { type: 'string', description: 'Detailed instructions on WHAT to generate or change in the file. Be extremely specific, as this will be executed by a separate agent who only sees this description.' },
            folder: { type: 'string', description: 'Optional target folder path if applicable' }
          },
          required: ['id', 'label', 'tool', 'title', 'description']
        }
      }
    },
    required: ['summary', 'tasks']
  }`,
  'readFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' }
    },
    required: ['title']
  }`,
  'updateFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      search: { type: 'string', description: 'Exact text to find and replace' },
      replace: { type: 'string', description: 'New text to insert' },
      content: { type: 'string', description: 'Full markdown content to overwrite the file' }
    },
    required: ['title']
  }`,
  'appendToFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      content: { type: 'string', description: 'Content to append' }
    },
    required: ['title', 'content']
  }`,
  'deleteFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' }
    },
    required: ['title']
  }`,
  'renameFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The current file title' },
      newTitle: { type: 'string', description: 'The new file title' }
    },
    required: ['title', 'newTitle']
  }`,
  'moveFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title' },
      folder: { type: 'string', description: 'The target folder path' }
    },
    required: ['title', 'folder']
  }`,
  'createFolder.js': `{
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The folder name' },
      parentFolder: { type: 'string', description: 'Optional parent folder path' }
    },
    required: ['name']
  }`,
  'renameFolder.js': `{
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The current folder name' },
      newName: { type: 'string', description: 'The new folder name' }
    },
    required: ['name', 'newName']
  }`,
  'deleteFolder.js': `{
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The folder name' }
    },
    required: ['name']
  }`,
  'openFile.js': `{
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The file title to open' }
    },
    required: ['title']
  }`
};

files.forEach(f => {
  const filePath = path.join(toolsDir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import { z } from 'zod'
  content = content.replace(/import { z } from 'zod'\n/g, '');

  if (schemas[f]) {
    // Replace parameters: z.object(...) with parameters: aiSdk.jsonSchema(...)
    content = content.replace(/parameters:\s*z\.object\([\s\S]*?\),/, 'parameters: aiSdk.jsonSchema(' + schemas[f] + '),');
    // For executeBulkPlan.js where it doesn't have a trailing comma
    content = content.replace(/parameters:\s*z\.object\([\s\S]*?\)\s+}\)/, 'parameters: aiSdk.jsonSchema(' + schemas[f] + ')\n  })');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed ' + f);
});
