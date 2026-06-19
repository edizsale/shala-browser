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

// Chrome benzeri sağ-tık menüsü: tıklanan yere göre (yazı kutusu, seçili
// metin, link, görsel, sayfanın boş alanı) uygun seçenekleri gösterir.
// isWebview=true ise navigasyon/sayfa seçenekleri (geri/ileri/yenile,
// kaynağı görüntüle, sayfayı kaydet) de eklenir.
function buildContextMenu(webContents, params, isWebview) {
  const items = [];

  if (params.linkURL) {
    items.push(
      {
        label: 'Bağlantıyı Yeni Sekmede Aç',
        click: () => mainWindow.webContents.send('open-url-in-new-tab', params.linkURL)
      },
      {
        label: 'Bağlantıyı Kopyala',
        click: () => require('electron').clipboard.writeText(params.linkURL)
      }
    );
  }

  if (params.hasImageContents) {
    if (items.length) items.push({ type: 'separator' });
    items.push(
      {
        label: 'Görseli Yeni Sekmede Aç',
        click: () => mainWindow.webContents.send('open-url-in-new-tab', params.srcURL)
      },
      {
        label: 'Görseli Kopyala',
        click: () => webContents.copyImageAt(params.x, params.y)
      },
      {
        label: 'Görsel Adresini Kopyala',
        click: () => require('electron').clipboard.writeText(params.srcURL)
      }
    );
  }

  if (params.isEditable) {
    if (items.length) items.push({ type: 'separator' });
    items.push(
      { label: 'Kes', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Kopyala', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Yapıştır', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Tümünü Seç', role: 'selectAll', enabled: params.editFlags.canSelectAll }
    );
  } else if (params.selectionText && params.selectionText.trim().length > 0) {
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Kopyala', role: 'copy' });
    if (isWebview) {
      items.push({
        label: `"${params.selectionText.trim().slice(0, 28)}${params.selectionText.trim().length > 28 ? '…' : ''}" için Google'da Ara`,
        click: () => {
          const query = encodeURIComponent(params.selectionText.trim());
          mainWindow.webContents.send('open-url-in-new-tab', `https://www.google.com/search?q=${query}`);
        }
      });
    }
  }

  // Sayfanın boş bir alanına (link/görsel/seçim/input olmayan) sağ tıklanmışsa
  // Chrome'daki gibi navigasyon ve sayfa seçenekleri ekle
  if (isWebview && !params.linkURL && !params.hasImageContents && !params.isEditable &&
      (!params.selectionText || params.selectionText.trim().length === 0)) {
    if (items.length) items.push({ type: 'separator' });
    items.push(
      { label: 'Geri', enabled: webContents.canGoBack(), click: () => webContents.goBack() },
      { label: 'İleri', enabled: webContents.canGoForward(), click: () => webContents.goForward() },
      { label: 'Yeniden Yükle', click: () => webContents.reload() },
      { type: 'separator' },
      {
        label: 'Sayfayı Farklı Kaydet…',
        click: () => webContents.downloadURL(webContents.getURL())
      },
      {
        label: 'Sayfa Kaynağını Görüntüle',
        click: () => {
          const sourceUrl = `view-source:${webContents.getURL()}`;
          mainWindow.webContents.send('open-url-in-new-tab', sourceUrl);
        }
      },
      { type: 'separator' },
      { label: 'İncele', click: () => webContents.inspectElement(params.x, params.y) }
    );
  }

  if (items.length === 0) return null;
  return Menu.buildFromTemplate(items);
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

  // Ana pencere (adres çubuğu, arama kutusu vb.) için sağ-tık menüsü
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = buildContextMenu(mainWindow.webContents, params, false);
    if (menu) menu.popup();
  });

  // Her webview için: F12 ile kendi DevTools'unu açabilme + popup engelleme
  // + sağ-tık menüsü (sekme içeriğindeki yazı kutuları, seçili metin, linkler,
  // ve sayfanın boş alanına tıklanınca Chrome benzeri navigasyon seçenekleri)
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    webContents.on('before-input-event', (e, input) => {
      if (input.key === 'F12') {
        webContents.toggleDevTools();
      }
    });

    webContents.on('context-menu', (e, params) => {
      const menu = buildContextMenu(webContents, params, true);
      if (menu) menu.popup();
    });

    // Native popup pencerelerini engelle — bunun yerine ana pencereye
    // mesaj gönderip kendi sekme sistemimizde açıyoruz
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
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-app-path', () => __dirname);

// ===== IPC: Sekme sağ-tık menüsü =====
// Sekmeler normal HTML elementleri (webview değil), bu yüzden menüyü
// renderer'dan gelen istekle burada (main process) inşa edip açıyoruz.
// Seçilen aksiyonu 'tab-context-menu-action' ile renderer'a geri bildiriyoruz.
ipcMain.on('show-tab-context-menu', (event, tabId) => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Yeni Sekme',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'new-tab', tabId)
    },
    { type: 'separator' },
    {
      label: 'Sekmeyi Yeniden Yükle',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'reload', tabId)
    },
    {
      label: 'Sekmeyi Çoğalt',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'duplicate', tabId)
    },
    { type: 'separator' },
    {
      label: 'Sekmeyi Kapat',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'close', tabId)
    },
    {
      label: 'Diğer Sekmeleri Kapat',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'close-others', tabId)
    },
    {
      label: 'Sağdaki Sekmeleri Kapat',
      click: () => mainWindow.webContents.send('tab-context-menu-action', 'close-to-right', tabId)
    }
  ]);
  menu.popup();
});
