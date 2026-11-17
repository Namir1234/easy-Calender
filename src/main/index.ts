import { app, clipboard, Menu, nativeImage, shell, Tray, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import outlookScript from '../../resources/outlook.ps1?asset'
import type { Settings } from '../shared/types'
import { AccountService } from './accounts'
import { readGoogleConfig, readMicrosoftConfig } from './config'
import { initStore } from './db'
import { registerIpc, type AppContext } from './ipc'
import { OutlookBridge, powershellRunner } from './providers/outlookLocal'
import { createEncryptedStorage } from './secureStorage'
import { loadSettings, saveSettings } from './settings'
import { SyncService } from './sync/service'

/** Mit diesem Argument startet Windows die App beim Anmelden: ohne Fenster. */
const HIDDEN_FLAG = '--hidden'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let settings: Settings

function createWindow(show: boolean): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'easy-Calender',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = window

  window.on('ready-to-show', () => {
    if (show) window.show()
  })

  // Schliessen versteckt das Fenster nur, wenn die App im Hintergrund
  // weiterlaufen soll. Der Abgleich läuft dann weiter.
  window.on('close', (event) => {
    if (!quitting && settings.closeToTray) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    mainWindow = null
  })

  // Links öffnen im Standardbrowser, nie in der App. Erlaubt ist nur https.
  window.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Das Fenster zeigt nur die eigene Oberfläche. Neu laden ist erlaubt
  // (braucht die Entwicklung), woanders hin navigieren nicht.
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })

  // In der Entwicklung kommt die Oberfläche vom Vite-Server (mit HMR),
  // sonst aus der gebauten HTML-Datei.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow(true)
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function applyAutostart(enabled: boolean): void {
  // In der Entwicklung würde sonst die nackte Electron-Laufzeit eingetragen.
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_FLAG] })
}

function createTray(syncNow: () => void): void {
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
  tray.setToolTip('easy-Calender')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'easy-Calender öffnen', click: showWindow },
      { label: 'Jetzt synchronisieren', click: syncNow },
      { type: 'separator' },
      {
        label: 'Beenden',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
}

// Es läuft immer nur eine App. Ein zweiter Start holt das Fenster nach vorn.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('ch.easycalender.app')

    // F12 öffnet in der Entwicklung die DevTools, Ctrl+R ist im fertigen Build gesperrt.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const userData = app.getPath('userData')
    const settingsFile = join(userData, 'settings.json')
    settings = loadSettings(settingsFile)

    // Die Datenquelle wird im Hintergrund verbunden, das Fenster erscheint sofort.
    const ready = initStore(import.meta.env, userData).then((context): AppContext => {
      const accounts = new AccountService({
        store: context.store,
        tokens: createEncryptedStorage(join(userData, 'tokens.bin')),
        google: readGoogleConfig(import.meta.env),
        microsoft: readMicrosoftConfig(import.meta.env),
        // PowerShell kann nicht ins App-Archiv hineinlesen. Das Skript liegt
        // darum entpackt daneben (siehe asarUnpack in electron-builder.yml).
        outlook: new OutlookBridge(
          powershellRunner(outlookScript.replace('app.asar', 'app.asar.unpacked'))
        ),
        openBrowser: (url) => shell.openExternal(url),
        copyText: (text) => clipboard.writeText(text)
      })
      const sync = new SyncService({
        store: context.store,
        providerFor: (account) => accounts.providerFor(account)
      })
      // Erst die Kalenderlisten abgleichen, dann die Termine. Fehler sind hier
      // nicht kritisch, sie zeigen sich beim Laden der Termine.
      void accounts
        .refreshCalendars()
        .catch(() => [])
        .then(() => sync.start())
      return { ...context, accounts, sync }
    })

    registerIpc(ready, {
      get: () => settings,
      set: (next) => {
        settings = next
        saveSettings(settingsFile, settings)
        applyAutostart(settings.autostart)
        return settings
      }
    })

    createTray(() => void ready.then(({ sync }) => sync.run()))
    createWindow(!process.argv.includes(HIDDEN_FLAG))

    app.on('activate', showWindow)
  })

  app.on('before-quit', () => {
    quitting = true
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
