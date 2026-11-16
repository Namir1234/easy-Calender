import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { AccountService } from './accounts'
import { readGoogleConfig } from './config'
import { initStore } from './db'
import { registerIpc, type AppContext } from './ipc'
import { createEncryptedStorage } from './secureStorage'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'easy-Calender',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Links öffnen im Standardbrowser, nie in der App. Erlaubt ist nur https.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Das Fenster zeigt nur die eigene Oberfläche. Neu laden ist erlaubt
  // (braucht die Entwicklung), woanders hin navigieren nicht.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault()
  })

  // In der Entwicklung kommt die Oberfläche vom Vite-Server (mit HMR),
  // sonst aus der gebauten HTML-Datei.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('ch.easycalender.app')

  // F12 öffnet in der Entwicklung die DevTools, Ctrl+R ist im fertigen Build gesperrt.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Die Datenquelle wird im Hintergrund verbunden, das Fenster erscheint sofort.
  const userData = app.getPath('userData')
  const ready = initStore(import.meta.env, userData).then((context): AppContext => {
    const accounts = new AccountService({
      store: context.store,
      tokens: createEncryptedStorage(join(userData, 'tokens.bin')),
      google: readGoogleConfig(import.meta.env),
      openBrowser: (url) => shell.openExternal(url)
    })
    // Kalenderlisten im Hintergrund abgleichen. Fehler sind hier nicht kritisch,
    // sie zeigen sich beim Laden der Termine.
    void accounts.refreshCalendars().catch(() => [])
    return { ...context, accounts }
  })
  registerIpc(ready)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
