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

export const getAITools = (blockReadFile) => {
  return {
    createFile: createFileTool,
    readFile: getReadFileTool(blockReadFile),
    openFile: openFileTool,
    updateFile: updateFileTool,
    appendToFile: appendToFileTool,
    renameFile: renameFileTool,
    deleteFile: deleteFileTool,
    createFolder: createFolderTool,
    renameFolder: renameFolderTool,
    deleteFolder: deleteFolderTool,
    moveFile: moveFileTool
  }
}
