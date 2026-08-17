import { app } from 'electron'

export function updateAutoLauncher(launchOnStartup) {
  // Check if we are packaged to prevent running during development
  if (!app.isPackaged) return

  app.setLoginItemSettings({
    openAtLogin: launchOnStartup === true,
    openAsHidden: true // Start hidden in the background
  })
}
