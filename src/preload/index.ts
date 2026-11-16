import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/types'

// Die einzige Verbindung zwischen Oberfläche und Main-Prozess.
// Der Renderer bekommt nur diese Funktionen, kein `ipcRenderer` und kein Node.
const api: AppApi = {
  getStatus: () => ipcRenderer.invoke('app:status'),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  connectGoogle: () => ipcRenderer.invoke('accounts:connectGoogle'),
  reopenLogin: () => ipcRenderer.invoke('accounts:reopenLogin'),
  copyLoginLink: () => ipcRenderer.invoke('accounts:copyLoginLink'),
  cancelLogin: () => ipcRenderer.invoke('accounts:cancelLogin'),
  removeAccount: (accountId) => ipcRenderer.invoke('accounts:remove', accountId),
  listCalendars: () => ipcRenderer.invoke('calendars:list'),
  setCalendarVisible: (calendarId, visible) =>
    ipcRenderer.invoke('calendars:setVisible', calendarId, visible),
  listEvents: (range) => ipcRenderer.invoke('events:list', range)
}

contextBridge.exposeInMainWorld('api', api)
