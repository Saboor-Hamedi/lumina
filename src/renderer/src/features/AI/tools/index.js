import { createFileTool } from './createFile'
import { getReadFileTool } from './readFile'
import { openFileTool } from './openFile'
import { updateFileTool } from './updateFile'
import { appendToFileTool } from './appendToFile'
import { renameFileTool } from './renameFile'
import { deleteFileTool } from './deleteFile'
import { moveFileTool } from './moveFile'
import { createFolderTool } from './createFolder'
import { renameFolderTool } from './renameFolder'
import { deleteFolderTool } from './deleteFolder'
import { moveFolderTool } from './moveFolder'
import { checkFileTool } from './checkFile'
import { clearFileTool } from './clearFile'
import { readBrainFileTool } from './readBrainFile'

export const getAITools = (blockReadFile) => {
  return {
    createFile: createFileTool,
    readFile: getReadFileTool(blockReadFile),
    readBrainFile: readBrainFileTool,
    clearFile: clearFileTool,
    openFile: openFileTool,
    updateFile: updateFileTool,
    appendToFile: appendToFileTool,
    renameFile: renameFileTool,
    deleteFile: deleteFileTool,
    createFolder: createFolderTool,
    renameFolder: renameFolderTool,
    deleteFolder: deleteFolderTool,
    moveFolder: moveFolderTool,
    moveFile: moveFileTool
  }
}
