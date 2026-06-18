const { app, BrowserWindow, Menu, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;

// Platforma göre doğru ikon formatını seç
function getIconPath() {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'build', 'icon.ico');
  } else if (process.platform === 'darwin') {
    return path.join(__dirname, 'build', 'icon.icns');
  }
  return path.join(__dirname, 'build', 'icon.png'); // Linux
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1612',
    frame: false,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      spellcheck: true
    }
  });

  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);
  registerShortcuts();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', 'maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', 'normal');
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus-changed', true);
  });

  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window-focus-changed', false);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Her <webview> için native popup pencerelerini engelle —
  // bunun yerine ana pencereye mesaj gönderip kendi sekme sistemimizde açıyoruz
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      mainWindow.webContents.send('open-url-in-new-tab', url);
      return { action: 'deny' };
    });
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

function registerShortcuts() {
  // Klavye kısayolları artık renderer.js içinde yakalanıyor
  // (Ctrl+T, Ctrl+W, Ctrl+F, Ctrl+Tab, F5, Alt+Ok tuşları vs.)
  // Native menu kaldırıldığı için burada ekstra bir şey gerekmiyor.
}

// ===== IPC: Pencere Kontrolleri =====
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

ipcMain.handle('window-is-maximized', () => mainWindow.isMaximized());
