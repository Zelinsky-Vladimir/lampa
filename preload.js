'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  openDialog: (labels) => ipcRenderer.invoke('dialog:open', labels),
  loadBook: (p) => ipcRenderer.invoke('book:load', p),
  takeInitialPath: () => ipcRenderer.invoke('app:take-initial-path'),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p)),
  pathForFile: (file) => webUtils.getPathForFile(file),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  toggleFullscreen: () => ipcRenderer.send('win:toggle-fullscreen'),
  setThemeBg: (color) => ipcRenderer.send('app:theme-bg', color),
  rendered: () => ipcRenderer.send('dev:rendered'),
  onUpdateReady: (cb) => ipcRenderer.on('update-ready', (_e, version) => cb(version)),
  installUpdate: () => ipcRenderer.send('app:install-update'),
});
