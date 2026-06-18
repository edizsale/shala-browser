const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Pencere kontrolleri
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Pencere durumu
  onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', (e, state) => callback(state)),
  onWindowFocusChanged: (callback) => ipcRenderer.on('window-focus-changed', (e, focused) => callback(focused)),

  // Menu olayları
  onMenuNewTab: (callback) => ipcRenderer.on('menu-new-tab', callback),
  onMenuCloseTab: (callback) => ipcRenderer.on('menu-close-tab', callback),
  onMenuNextTab: (callback) => ipcRenderer.on('menu-next-tab', callback),
  onMenuPrevTab: (callback) => ipcRenderer.on('menu-prev-tab', callback),
  onMenuReload: (callback) => ipcRenderer.on('menu-reload', callback),
  onMenuFindInPage: (callback) => ipcRenderer.on('menu-find-in-page', callback),
  onOpenUrlInNewTab: (callback) => ipcRenderer.on('open-url-in-new-tab', (e, url) => callback(url)),

  // Zoom
  onZoomIn: (callback) => ipcRenderer.on('zoom-in', callback),
  onZoomOut: (callback) => ipcRenderer.on('zoom-out', callback),
  onZoomReset: (callback) => ipcRenderer.on('zoom-reset', callback)
});
