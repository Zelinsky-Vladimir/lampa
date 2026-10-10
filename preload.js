'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  openDialog: (labels) => ipcRenderer.invoke('dialog:open', labels),
  loadBook: (p) => ipcRenderer.invoke('book:load', p),
  adoptBooks: (paths) => ipcRenderer.invoke('books:adopt', paths),
  forgetBook: (p) => ipcRenderer.invoke('books:forget', p),
  shelfLoad: () => ipcRenderer.invoke('shelf:load'),
  shelfSave: (books) => ipcRenderer.invoke('shelf:save', books),
  shelfSearch: (q) => ipcRenderer.invoke('shelf:search', q),
  shelfThumb: (url) => ipcRenderer.invoke('shelf:thumb', url),
  shelfCover: (url) => ipcRenderer.invoke('shelf:cover', url),
  takeInitialPath: () => ipcRenderer.invoke('app:take-initial-path'),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  pathForFile: (file) => webUtils.getPathForFile(file),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  toggleFullscreen: () => ipcRenderer.send('win:toggle-fullscreen'),
  setThemeBg: (color) => ipcRenderer.send('app:theme-bg', color),
  rendered: () => ipcRenderer.send('dev:rendered'),
  onUpdateReady: (cb) => ipcRenderer.on('update-ready', (_e, version) => cb(version)),
  installUpdate: () => ipcRenderer.send('app:install-update'),
  setUiLang: (lang) => ipcRenderer.send('app:ui-lang', lang),
  translate: (text, to) => ipcRenderer.invoke('translate', { text, to }),
  capture: (rect) => ipcRenderer.invoke('capture', rect),
});
