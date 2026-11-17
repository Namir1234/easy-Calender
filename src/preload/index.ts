import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/types'

// Die einzige Verbindung zwischen Oberfläche und Main-Prozess.
// Der Renderer bekommt nur diese Funktionen, kein `ipcRenderer` und kein Node.
const api: AppApi = {
  getStatus: () => ipcRenderer.invoke('app:status'),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  connectGoogle: () => ipcRenderer.invoke('accounts:connectGoogle'),
  connectMicrosoft: () => ipcRenderer.invoke('accounts:connectMicrosoft'),
  reopenLogin: () => ipcRenderer.invoke('accounts:reopenLogin'),
  copyLoginLink: () => ipcRenderer.invoke('accounts:copyLoginLink'),
  cancelLogin: () => ipcRenderer.invoke('accounts:cancelLogin'),
  removeAccount: (accountId) => ipcRenderer.invoke('accounts:remove', accountId),
  listCalendars: () => ipcRenderer.invoke('calendars:list'),
  setCalendarVisible: (calendarId, visible) =>
    ipcRenderer.invoke('calendars:setVisible', calendarId, visible),
  setCalendarOptions: (calendarId, options) =>
    ipcRenderer.invoke('calendars:setOptions', calendarId, options),
  createCalendar: (accountId, name) => ipcRenderer.invoke('calendars:create', accountId, name),
  listEvents: (range) => ipcRenderer.invoke('events:list', range),
  createEvent: (calendarId, input) => ipcRenderer.invoke('events:create', calendarId, input),
  updateEvent: (calendarId, eventId, input) =>
    ipcRenderer.invoke('events:update', calendarId, eventId, input),
  deleteEvent: (calendarId, eventId) => ipcRenderer.invoke('events:delete', calendarId, eventId),
  listSyncPairs: () => ipcRenderer.invoke('sync:listPairs'),
  addSyncPair: (googleCalendarId, msCalendarId) =>
    ipcRenderer.invoke('sync:addPair', googleCalendarId, msCalendarId),
  removeSyncPair: (pairId) => ipcRenderer.invoke('sync:removePair', pairId),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings)
}

contextBridge.exposeInMainWorld('api', api)
