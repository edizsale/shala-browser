// ============================================
// SHALA BROWSER — Renderer Logic
// ============================================

let DEFAULT_URL = 'newtab.html';
const STORAGE_KEY_BOOKMARKS = 'shala-bookmarks';
const STORAGE_KEY_SESSION = 'shala-session-tabs';
const STORAGE_KEY_HISTORY = 'shala-history';

// ----- DOM refs -----
const tabStrip = document.getElementById('tabStrip');
const newTabBtn = document.getElementById('newTabBtn');
const webviewContainer = document.getElementById('webviewContainer');
const addressBar = document.getElementById('addressBar');
const addressBarContainer = document.querySelector('.address-bar-container');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const homeBtn = document.getElementById('homeBtn');
const goBtn = document.getElementById('goBtn');
const starBtn = document.getElementById('starBtn');
const findBtn = document.getElementById('findBtn');
const aboutBtn = document.getElementById('aboutBtn');
const securityIndicator = document.getElementById('securityIndicator');
const suggestionsDropdown = document.getElementById('suggestionsDropdown');
const statusbar = document.getElementById('statusbar');
const statusText = document.getElementById('statusText');
const bookmarkBar = document.getElementById('bookmarkBar');
const findBar = document.getElementById('findBar');
const findInput = document.getElementById('findInput');
const findCount = document.getElementById('findCount');
const findPrev = document.getElementById('findPrev');
const findNext = document.getElementById('findNext');
const findClose = document.getElementById('findClose');
// Pencere kontrolleri — platforma göre iki ayrı set (Mac/Linux solda, Windows sağda)
const minimizeBtnMac = document.getElementById('minimizeBtnMac');
const maximizeBtnMac = document.getElementById('maximizeBtnMac');
const closeBtnMac = document.getElementById('closeBtnMac');
const minimizeBtnWin = document.getElementById('minimizeBtnWin');
const maximizeBtnWin = document.getElementById('maximizeBtnWin');
const closeBtnWin = document.getElementById('closeBtnWin');
const aboutModal = document.getElementById('aboutModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const historyClearBtn = document.getElementById('historyClearBtn');
const historySearch = document.getElementById('historySearch');
const historySearchClear = document.getElementById('historySearchClear');
const historyList = document.getElementById('historyList');

// ============================================
// ICONS (reused SVG strings)
// ============================================
const ICONS = {
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l3 6.5 7 .9-5 5 1.3 7-6.3-3.5L5.7 22l1.3-7-5-5 7-.9z"/></svg>`,
  close: `<svg viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`
};

// ============================================
// TAB CLASS
// ============================================
let tabIdCounter = 0;

class Tab {
  constructor(url = DEFAULT_URL) {
    this.id = `tab-${++tabIdCounter}-${Date.now()}`;
    this.url = url;
    this.title = 'Yeni Sekme';
    this.favicon = null;
    this.isLoading = false;
    this.canGoBack = false;
    this.canGoForward = false;
    this.history = [];
    this.historyIndex = -1;

    this._buildDom();
  }

  _buildDom() {
    // Tab strip butonu
    this.tabEl = document.createElement('div');
    this.tabEl.className = 'tab';
    this.tabEl.dataset.tabId = this.id;
    this.tabEl.innerHTML = `
      <span class="tab-favicon">${ICONS.globe}</span>
      <span class="tab-title">Yeni Sekme</span>
      <span class="tab-close" data-tooltip="Sekmeyi kapat">${ICONS.close}</span>
    `;
    this.tabEl.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close')) {
        tabManager.closeTab(this.id);
      } else {
        tabManager.activateTab(this.id);
      }
    });
    this.tabEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      tabManager.activateTab(this.id);
      window.electronAPI.showTabContextMenu(this.id);
    });
    // Orta tık (mouse wheel click) ile sekmeyi kapat — Chrome'daki standart
    // davranış. mousedown'da preventDefault, tarayıcının varsayılan
    // "autoscroll" moduna girmesini en başından engeller.
    this.tabEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    this.tabEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        tabManager.closeTab(this.id);
      }
    });
    tabStrip.appendChild(this.tabEl);

    // Webview
    this.webview = document.createElement('webview');
    this.webview.setAttribute('src', this.url);
    this.webview.setAttribute('allowpopups', '');
    this.webview.dataset.tabId = this.id;
    webviewContainer.appendChild(this.webview);

    this._attachWebviewListeners();
  }

  _attachWebviewListeners() {
    const wv = this.webview;

    wv.addEventListener('did-start-loading', () => {
      this.isLoading = true;
      this._setFaviconLoading(true);
      if (this.isActive()) showProgress();
    });

    wv.addEventListener('did-stop-loading', () => {
      this.isLoading = false;
      this._setFaviconLoading(false);
      this.canGoBack = wv.canGoBack();
      this.canGoForward = wv.canGoForward();
      if (this.isActive()) {
        hideProgress();
        updateNavButtons();
        updateAddressBar();
        updateStarState();
      }
      tabManager.saveSession();
    });

    wv.addEventListener('did-navigate', (e) => {
      this.url = e.url;
      if (this.isActive()) updateAddressBar();
      tabManager.saveSession();
    });

    wv.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        this.url = e.url;
        if (this.isActive()) updateAddressBar();
      }
    });

    wv.addEventListener('page-title-updated', (e) => {
      this.title = e.title || this.url;
      this._updateTabTitle();
      if (this.isActive()) document.title = `${this.title} — SHALA Browser`;
      historyManager.add(this.url, this.title, this.favicon);
    });

    wv.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length) {
        this.favicon = e.favicons[0];
        this._updateTabFavicon();
      }
    });

    wv.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return; // aborted, ignore
      this.isLoading = false;
      this._setFaviconLoading(false);
      if (this.isActive()) hideProgress();
    });

    wv.addEventListener('new-window', (e) => {
      // Fallback — asıl yönlendirme main.js setWindowOpenHandler üzerinden geliyor
      tabManager.createTab(e.url, true);
    });

    wv.addEventListener('did-change-theme-color', () => {});

    // Durum çubuğu — link hover (Electron'da via dom-ready + ipc-message custom değil;
    // basit alternatif: update-target-url eventi)
    wv.addEventListener('update-target-url', (e) => {
      if (!this.isActive()) return;
      if (e.url) {
        statusText.textContent = e.url;
        statusbar.classList.add('visible');
      } else {
        statusbar.classList.remove('visible');
      }
    });
  }

  _setFaviconLoading(loading) {
    const faviconEl = this.tabEl.querySelector('.tab-favicon');
    if (loading) {
      faviconEl.classList.add('loading');
      faviconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-2.6-6.4" stroke-linecap="round"/></svg>`;
    } else {
      faviconEl.classList.remove('loading');
      this._updateTabFavicon();
    }
  }

  _updateTabFavicon() {
    const faviconEl = this.tabEl.querySelector('.tab-favicon');
    if (this.favicon) {
      faviconEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = this.favicon;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '2px';
      img.addEventListener('error', () => {
        faviconEl.innerHTML = ICONS.globe;
      });
      faviconEl.appendChild(img);
    } else {
      faviconEl.innerHTML = ICONS.globe;
    }
  }

  _updateTabTitle() {
    const titleEl = this.tabEl.querySelector('.tab-title');
    titleEl.textContent = this.title;
    titleEl.setAttribute('data-tooltip', this.title);
  }

  isActive() {
    return tabManager.activeTabId === this.id;
  }

  navigate(url) {
    this.webview.src = url;
  }

  destroy() {
    this.tabEl.remove();
    this.webview.remove();
  }
}

// ============================================
// TAB MANAGER
// ============================================
class TabManager {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
  }

  createTab(url = DEFAULT_URL, activate = true) {
    const tab = new Tab(url);
    this.tabs.set(tab.id, tab);
    if (activate) this.activateTab(tab.id);
    this.saveSession();
    return tab;
  }

  activateTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Deactivate previous
    if (this.activeTabId) {
      const prev = this.tabs.get(this.activeTabId);
      if (prev) {
        prev.tabEl.classList.remove('active');
        prev.webview.classList.remove('active-view');
      }
    }

    this.activeTabId = id;
    tab.tabEl.classList.add('active');
    tab.webview.classList.add('active-view');

    // Scroll tab into view
    tab.tabEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    updateNavButtons();
    updateAddressBar();
    updateStarState();
    document.title = `${tab.title} — SHALA Browser`;
    statusbar.classList.remove('visible');
  }

  closeTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    const ids = Array.from(this.tabs.keys());
    const idx = ids.indexOf(id);

    tab.destroy();
    this.tabs.delete(id);

    if (this.tabs.size === 0) {
      this.createTab();
      return;
    }

    if (this.activeTabId === id) {
      // Activate neighboring tab
      const newIds = Array.from(this.tabs.keys());
      const newIdx = Math.min(idx, newIds.length - 1);
      this.activateTab(newIds[newIdx]);
    }
    this.saveSession();
  }

  closeOthers(keepId) {
    const idsToClose = Array.from(this.tabs.keys()).filter(id => id !== keepId);
    idsToClose.forEach(id => this.closeTab(id));
  }

  closeToRight(fromId) {
    const ids = Array.from(this.tabs.keys());
    const idx = ids.indexOf(fromId);
    if (idx === -1) return;
    const idsToClose = ids.slice(idx + 1);
    idsToClose.forEach(id => this.closeTab(id));
  }

  duplicateTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.createTab(tab.url, true);
  }

  getActiveTab() {
    return this.tabs.get(this.activeTabId);
  }

  nextTab() {
    const ids = Array.from(this.tabs.keys());
    const idx = ids.indexOf(this.activeTabId);
    this.activateTab(ids[(idx + 1) % ids.length]);
  }

  prevTab() {
    const ids = Array.from(this.tabs.keys());
    const idx = ids.indexOf(this.activeTabId);
    this.activateTab(ids[(idx - 1 + ids.length) % ids.length]);
  }

  saveSession() {
    try {
      const urls = Array.from(this.tabs.values())
        .map(t => t.url)
        .filter(u => u && !u.includes('newtab.html'));
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(urls));
    } catch (e) {}
  }

  restoreSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSION) || '[]');
      if (saved.length) {
        saved.forEach((url, i) => this.createTab(url, i === 0));
        return true;
      }
    } catch (e) {}
    return false;
  }
}

const tabManager = new TabManager();

// ============================================
// BOOKMARK MANAGER
// ============================================
class BookmarkManager {
  constructor() {
    this.bookmarks = this._load();
    this.render();
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_BOOKMARKS) || '[]');
    } catch (e) {
      return [];
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(this.bookmarks));
  }

  has(url) {
    return this.bookmarks.some(b => b.url === url);
  }

  add(url, title, favicon) {
    if (this.has(url)) return;
    this.bookmarks.push({ url, title: title || url, favicon: favicon || null });
    this._save();
    this.render();
  }

  remove(url) {
    this.bookmarks = this.bookmarks.filter(b => b.url !== url);
    this._save();
    this.render();
  }

  toggle(url, title, favicon) {
    if (this.has(url)) {
      this.remove(url);
      return false;
    } else {
      this.add(url, title, favicon);
      return true;
    }
  }

  render() {
    bookmarkBar.innerHTML = '<span class="bookmark-bar-empty" id="bookmarkBarEmpty">⚜ Yer imlerin burada görünecek — sayfayı yıldızla ekle</span>';

    if (this.bookmarks.length === 0) {
      bookmarkBar.classList.remove('has-items');
      return;
    }

    bookmarkBar.classList.add('has-items');

    this.bookmarks.forEach(bm => {
      const chip = document.createElement('div');
      chip.className = 'bookmark-chip';
      chip.setAttribute('data-tooltip', bm.url);

      const faviconSpan = document.createElement('span');
      faviconSpan.className = 'chip-favicon';
      if (bm.favicon) {
        const img = document.createElement('img');
        img.src = bm.favicon;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.addEventListener('error', () => {
          faviconSpan.innerHTML = ICONS.globe;
        });
        faviconSpan.appendChild(img);
      } else {
        faviconSpan.innerHTML = ICONS.globe;
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = truncate(bm.title, 22);

      const removeSpan = document.createElement('span');
      removeSpan.className = 'chip-remove';
      removeSpan.innerHTML = ICONS.close;

      chip.appendChild(faviconSpan);
      chip.appendChild(labelSpan);
      chip.appendChild(removeSpan);

      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-remove')) {
          this.remove(bm.url);
        } else {
          const tab = tabManager.getActiveTab();
          if (tab) tab.navigate(bm.url);
        }
      });

      bookmarkBar.appendChild(chip);
    });
  }
}

const bookmarkManager = new BookmarkManager();

// ============================================
// HISTORY MANAGER
// ============================================
class HistoryManager {
  constructor() {
    this.items = this._load();
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    } catch (e) {
      return [];
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.items));
  }

  add(url, title, favicon) {
    if (!url || url.includes('newtab.html') || url.startsWith('file://')) return;
    this.items = this.items.filter(i => i.url !== url);
    this.items.unshift({ url, title: title || url, favicon: favicon || null, ts: Date.now() });
    if (this.items.length > 500) this.items = this.items.slice(0, 500);
    this._save();
  }

  remove(url) {
    this.items = this.items.filter(i => i.url !== url);
    this._save();
  }

  clear() {
    this.items = [];
    this._save();
  }

  search(query) {
    const q = query.toLowerCase();
    return this.items.filter(i =>
      i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
    );
  }
}

const historyManager = new HistoryManager();

// ============================================
// HISTORY PANEL
// ============================================
function formatHistoryTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatHistoryGroupLabel(ts) {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDay.getTime() === today.getTime()) return 'Bugün';
  if (itemDay.getTime() === yesterday.getTime()) return 'Dün';

  const diffDays = Math.floor((today - itemDay) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString('tr-TR', { weekday: 'long' });
  }
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderHistoryPanel(items) {
  historyList.innerHTML = '';

  if (items.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
        Henüz ziyaret edilen site yok
      </div>`;
    return;
  }

  let lastLabel = null;
  items.forEach(item => {
    const label = formatHistoryGroupLabel(item.ts);
    if (label !== lastLabel) {
      const groupEl = document.createElement('div');
      groupEl.className = 'history-group-label';
      groupEl.textContent = label;
      historyList.appendChild(groupEl);
      lastLabel = label;
    }

    const el = document.createElement('div');
    el.className = 'history-item';

    const faviconEl = document.createElement('div');
    faviconEl.className = 'history-item-favicon';
    if (item.favicon) {
      const img = document.createElement('img');
      img.src = item.favicon;
      img.addEventListener('error', () => { faviconEl.innerHTML = ICONS.globe; });
      faviconEl.appendChild(img);
    } else {
      faviconEl.innerHTML = ICONS.globe;
    }

    const infoEl = document.createElement('div');
    infoEl.className = 'history-item-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'history-item-title';
    titleEl.textContent = item.title;
    const urlEl = document.createElement('div');
    urlEl.className = 'history-item-url';
    urlEl.textContent = item.url;
    infoEl.appendChild(titleEl);
    infoEl.appendChild(urlEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'history-item-time';
    timeEl.textContent = formatHistoryTime(item.ts);

    const delBtn = document.createElement('button');
    delBtn.className = 'history-item-del';
    delBtn.title = 'Kaldır';
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>`;

    el.appendChild(faviconEl);
    el.appendChild(infoEl);
    el.appendChild(timeEl);
    el.appendChild(delBtn);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.history-item-del')) {
        historyManager.remove(item.url);
        el.remove();
        return;
      }
      const tab = tabManager.getActiveTab();
      if (tab) {
        tab.navigate(item.url);
        closeHistoryPanel();
      }
    });

    historyList.appendChild(el);
  });
}

function openHistoryPanel() {
  historyPanel.classList.add('visible');
  historyBtn.classList.add('active');
  historySearch.value = '';
  historySearchClear.style.display = 'none';
  renderHistoryPanel(historyManager.items);
  historySearch.focus();
}

function closeHistoryPanel() {
  historyPanel.classList.remove('visible');
  historyBtn.classList.remove('active');
}

historyBtn.addEventListener('click', () => {
  if (historyPanel.classList.contains('visible')) closeHistoryPanel();
  else openHistoryPanel();
});

historyCloseBtn.addEventListener('click', closeHistoryPanel);

historyClearBtn.addEventListener('click', () => {
  historyManager.clear();
  renderHistoryPanel([]);
});

historySearch.addEventListener('input', () => {
  const q = historySearch.value.trim();
  historySearchClear.style.display = q ? 'flex' : 'none';
  renderHistoryPanel(q ? historyManager.search(q) : historyManager.items);
});

historySearchClear.addEventListener('click', () => {
  historySearch.value = '';
  historySearchClear.style.display = 'none';
  renderHistoryPanel(historyManager.items);
  historySearch.focus();
});

// ============================================
// HELPERS
// ============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return null;

  const looksLikeUrl = /^https?:\/\//i.test(url) || /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(url) || url === 'localhost';

  if (/^https?:\/\//i.test(url)) {
    return url;
  } else if (looksLikeUrl && !url.includes(' ')) {
    return `https://${url}`;
  } else {
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
}

let progressTimer = null;
function showProgress() {
  let bar = document.querySelector('.load-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'load-progress';
    webviewContainer.appendChild(bar);
  }
  bar.classList.remove('hidden');
  bar.style.width = '0%';
  clearTimeout(progressTimer);
  requestAnimationFrame(() => { bar.style.width = '40%'; });
  progressTimer = setTimeout(() => { bar.style.width = '75%'; }, 350);
}

function hideProgress() {
  const bar = document.querySelector('.load-progress');
  if (!bar) return;
  bar.style.width = '100%';
  clearTimeout(progressTimer);
  setTimeout(() => {
    bar.classList.add('hidden');
  }, 200);
}

function updateNavButtons() {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  backBtn.disabled = !tab.webview.canGoBack || !tab.webview.canGoBack();
  forwardBtn.disabled = !tab.webview.canGoForward || !tab.webview.canGoForward();
}

function updateAddressBar() {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  const url = tab.url || '';
  if (url.includes('newtab.html')) {
    addressBar.value = '';
    addressBar.placeholder = 'Bir adres yazın veya arama yapın';
  } else {
    addressBar.value = url;
  }

  const isSecure = url.startsWith('https://') || url.includes('newtab.html');
  securityIndicator.classList.toggle('insecure', !isSecure && url.length > 0);
}

function updateStarState() {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  const isBookmarked = bookmarkManager.has(tab.url);
  starBtn.classList.toggle('starred', isBookmarked);
}

// ============================================
// EVENT WIRING
// ============================================

newTabBtn.addEventListener('click', () => tabManager.createTab());

backBtn.addEventListener('click', () => {
  const tab = tabManager.getActiveTab();
  if (tab && tab.webview.canGoBack()) tab.webview.goBack();
});

forwardBtn.addEventListener('click', () => {
  const tab = tabManager.getActiveTab();
  if (tab && tab.webview.canGoForward()) tab.webview.goForward();
});

reloadBtn.addEventListener('click', () => {
  const tab = tabManager.getActiveTab();
  if (tab) {
    reloadBtn.classList.add('spinning');
    tab.webview.reload();
    setTimeout(() => reloadBtn.classList.remove('spinning'), 600);
  }
});

homeBtn.addEventListener('click', () => {
  const tab = tabManager.getActiveTab();
  if (tab) tab.navigate(DEFAULT_URL);
});

goBtn.addEventListener('click', navigateFromAddressBar);

// ============================================
// ARAMA ÖNERİLERİ (Google autocomplete)
// ============================================
let suggestionTimer = null;
let currentSuggestions = [];
let highlightedIndex = -1;

function positionSuggestionsDropdown() {
  const rect = addressBarContainer.getBoundingClientRect();
  suggestionsDropdown.style.left = `${rect.left}px`;
  suggestionsDropdown.style.top = `${rect.bottom + 4}px`;
  suggestionsDropdown.style.width = `${rect.width}px`;
}

function renderSuggestions(items) {
  currentSuggestions = items;
  highlightedIndex = -1;
  suggestionsDropdown.innerHTML = '';

  if (items.length === 0) {
    hideSuggestions();
    return;
  }

  items.forEach((text, i) => {
    const el = document.createElement('div');
    el.className = 'suggestion-item';
    el.dataset.index = i;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
      <span class="suggestion-text"></span>
    `;
    el.querySelector('.suggestion-text').textContent = text;
    el.addEventListener('mousedown', (e) => {
      // mousedown (blur'dan önce) kullanıyoruz ki addressBar'ın
      // 'blur' event'i dropdown'ı tıklamadan önce kapatmasın
      e.preventDefault();
      selectSuggestion(text);
    });
    el.addEventListener('mouseenter', () => setHighlighted(i));
    suggestionsDropdown.appendChild(el);
  });

  positionSuggestionsDropdown();
  suggestionsDropdown.classList.add('visible');
}

function setHighlighted(index) {
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
  items.forEach((el, i) => el.classList.toggle('highlighted', i === index));
  highlightedIndex = index;
}

function selectSuggestion(text) {
  addressBar.value = text;
  hideSuggestions();
  navigateFromAddressBar();
}

function hideSuggestions() {
  suggestionsDropdown.classList.remove('visible');
  suggestionsDropdown.innerHTML = '';
  currentSuggestions = [];
  highlightedIndex = -1;
}

addressBar.addEventListener('input', () => {
  const query = addressBar.value.trim();
  clearTimeout(suggestionTimer);

  if (!query) {
    hideSuggestions();
    return;
  }

  // 150ms debounce — her tuş vuruşunda istek atmamak için
  suggestionTimer = setTimeout(async () => {
    try {
      const suggestions = await window.electronAPI.getSearchSuggestions(query);
      // Kullanıcı yazmaya devam ettiyse (input değiştiyse) eski sonucu görmezden gel
      if (addressBar.value.trim() === query) {
        renderSuggestions(suggestions.slice(0, 8));
      }
    } catch (e) {
      hideSuggestions();
    }
  }, 150);
});

addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedIndex >= 0 && currentSuggestions[highlightedIndex]) {
      selectSuggestion(currentSuggestions[highlightedIndex]);
    } else {
      hideSuggestions();
      navigateFromAddressBar();
    }
    return;
  }
  if (e.key === 'Escape') {
    if (suggestionsDropdown.classList.contains('visible')) {
      hideSuggestions();
    } else {
      updateAddressBar();
      addressBar.blur();
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    if (currentSuggestions.length === 0) return;
    e.preventDefault();
    setHighlighted((highlightedIndex + 1) % currentSuggestions.length);
    return;
  }
  if (e.key === 'ArrowUp') {
    if (currentSuggestions.length === 0) return;
    e.preventDefault();
    setHighlighted((highlightedIndex - 1 + currentSuggestions.length) % currentSuggestions.length);
    return;
  }
});

window.addEventListener('resize', () => {
  if (suggestionsDropdown.classList.contains('visible')) positionSuggestionsDropdown();
});

addressBar.addEventListener('focus', () => {
  addressBarContainer.classList.add('focused');
  addressBar.select();
});
addressBar.addEventListener('blur', () => {
  addressBarContainer.classList.remove('focused');
  hideSuggestions();
});

function navigateFromAddressBar() {
  const url = normalizeUrl(addressBar.value);
  if (!url) return;
  const tab = tabManager.getActiveTab();
  if (tab) {
    tab.navigate(url);
    addressBar.blur();
  }
}

starBtn.addEventListener('click', () => {
  const tab = tabManager.getActiveTab();
  if (!tab || tab.url.includes('newtab.html')) return;
  bookmarkManager.toggle(tab.url, tab.title, tab.favicon);
  updateStarState();
});

// Window controls — her iki set de aynı IPC fonksiyonlarını çağırır
minimizeBtnMac.addEventListener('click', () => window.electronAPI.minimizeWindow());
maximizeBtnMac.addEventListener('click', () => window.electronAPI.maximizeWindow());
closeBtnMac.addEventListener('click', () => window.electronAPI.closeWindow());

minimizeBtnWin.addEventListener('click', () => window.electronAPI.minimizeWindow());
maximizeBtnWin.addEventListener('click', () => window.electronAPI.maximizeWindow());
closeBtnWin.addEventListener('click', () => window.electronAPI.closeWindow());

// About modal
aboutBtn.addEventListener('click', () => aboutModal.classList.add('show'));
modalCloseBtn.addEventListener('click', () => aboutModal.classList.remove('show'));
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal) aboutModal.classList.remove('show');
});

// ============================================
// FIND IN PAGE
// ============================================
let findActive = false;

function openFindBar() {
  findBar.classList.add('visible');
  findActive = true;
  findInput.focus();
  findInput.select();
}

function closeFindBar() {
  findBar.classList.remove('visible');
  findActive = false;
  const tab = tabManager.getActiveTab();
  if (tab && tab.webview.stopFindInPage) {
    tab.webview.stopFindInPage('clearSelection');
  }
  findInput.value = '';
  findCount.textContent = '0/0';
}

findBtn.addEventListener('click', () => {
  if (findActive) closeFindBar();
  else openFindBar();
});

findClose.addEventListener('click', closeFindBar);

findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doFind(!e.shiftKey);
  if (e.key === 'Escape') closeFindBar();
});

findInput.addEventListener('input', () => doFind(true));
findPrev.addEventListener('click', () => doFind(false));
findNext.addEventListener('click', () => doFind(true));

function doFind(forward) {
  const tab = tabManager.getActiveTab();
  if (!tab || !findInput.value) return;
  tab.webview.findInPage(findInput.value, { forward, findNext: true });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 't') {
    e.preventDefault();
    tabManager.createTab();
  } else if (mod && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (tabManager.activeTabId) tabManager.closeTab(tabManager.activeTabId);
  } else if (mod && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    addressBar.focus();
  } else if (mod && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindBar();
  } else if (mod && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    reloadBtn.click();
  } else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    historyBtn.click();
  } else if (mod && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    homeBtn.click();
  } else if (mod && e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) tabManager.prevTab(); else tabManager.nextTab();
  } else if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    backBtn.click();
  } else if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    forwardBtn.click();
  } else if (e.key === 'F5') {
    e.preventDefault();
    reloadBtn.click();
  } else if (e.key === 'Escape' && findActive) {
    closeFindBar();
  }
});

// ============================================
// IPC FROM MAIN (menu actions)
// ============================================
window.electronAPI.onMenuNewTab(() => tabManager.createTab());
window.electronAPI.onMenuCloseTab(() => {
  if (tabManager.activeTabId) tabManager.closeTab(tabManager.activeTabId);
});
window.electronAPI.onMenuNextTab(() => tabManager.nextTab());
window.electronAPI.onMenuPrevTab(() => tabManager.prevTab());
window.electronAPI.onMenuReload(() => reloadBtn.click());
window.electronAPI.onMenuFindInPage(() => openFindBar());
window.electronAPI.onOpenUrlInNewTab((url) => {
  tabManager.createTab(url, true);
});

window.electronAPI.onTabContextMenuAction((action, tabId) => {
  switch (action) {
    case 'new-tab':
      tabManager.createTab();
      break;
    case 'reload': {
      const tab = tabManager.tabs.get(tabId);
      if (tab) tab.webview.reload();
      break;
    }
    case 'duplicate':
      tabManager.duplicateTab(tabId);
      break;
    case 'close':
      tabManager.closeTab(tabId);
      break;
    case 'close-others':
      tabManager.closeOthers(tabId);
      break;
    case 'close-to-right':
      tabManager.closeToRight(tabId);
      break;
  }
});
window.electronAPI.onWindowFocusChanged((focused) => {
  document.body.classList.toggle('window-blurred', !focused);
});

window.electronAPI.onZoomIn(() => {
  const tab = tabManager.getActiveTab();
  if (tab) tab.webview.setZoomFactor(Math.min((tab.webview.getZoomFactor() || 1) + 0.1, 3));
});
window.electronAPI.onZoomOut(() => {
  const tab = tabManager.getActiveTab();
  if (tab) tab.webview.setZoomFactor(Math.max((tab.webview.getZoomFactor() || 1) - 0.1, 0.5));
});
window.electronAPI.onZoomReset(() => {
  const tab = tabManager.getActiveTab();
  if (tab) tab.webview.setZoomFactor(1);
});

window.electronAPI.onWindowStateChanged((state) => {
  // macOS/Linux traffic-light ikonu (diagonal ok stili)
  const iconMac = maximizeBtnMac.querySelector('svg');
  if (state === 'maximized') {
    iconMac.innerHTML = '<path d="M3 2.3v1.4H1.6M3 3.7L1 1.7M7 7.7V6.3h1.4M7 6.3L9 8.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  } else {
    iconMac.innerHTML = '<path d="M2 5h6M5 2v6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" transform="rotate(45 5 5)"/>';
  }

  // Windows klasik ikonu (tek kare ↔ üst üste binmiş çift kare)
  const iconWin = maximizeBtnWin.querySelector('svg');
  if (state === 'maximized') {
    iconWin.innerHTML = '<rect x="2.5" y="1.5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1.5 3.5h-1v6h6v-1" fill="none" stroke="currentColor" stroke-width="1"/>';
  } else {
    iconWin.innerHTML = '<rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/>';
  }
});

// ============================================
// INIT
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  // Platform tespiti — Windows'ta pencere butonları sağa, kare stile geçer
  try {
    const platform = await window.electronAPI.getPlatform();
    if (platform === 'win32') {
      document.body.classList.add('platform-win32');
    }
  } catch (e) {
    // getPlatform desteklenmiyorsa varsayılan (macOS/Linux) görünüm kalır
  }

  // newtab.html'i mutlak file:// yoluna çeviriyoruz — webview'lar göreli
  // yolları kendi konumlarına göre çözebildiği için, bazı durumlarda
  // (örn. paketlenmiş build) içindeki assets/ referansları (bayrak görseli
  // gibi) yanlış konumdan aranabiliyordu. Mutlak yol bu sorunu kökten çözer.
  try {
    const appPath = await window.electronAPI.getAppPath();
    if (appPath) {
      // Windows ters slash → ileri slash
      const normalized = appPath.replace(/\\/g, '/');
      // Başında / varsa (Linux/Mac: /home/...) tek bir file:// öneki yeter.
      // Yoksa (Windows: C:/...) bir slash daha eklememiz gerekir.
      const prefix = normalized.startsWith('/') ? 'file://' : 'file:///';
      DEFAULT_URL = `${prefix}${normalized}/newtab.html`;
    }
  } catch (e) {
    // getAppPath desteklenmiyorsa göreli 'newtab.html' yolu kullanılır
  }

  const restored = tabManager.restoreSession();
  if (!restored) {
    tabManager.createTab(DEFAULT_URL);
  }
});

window.addEventListener('beforeunload', () => {
  tabManager.saveSession();
});
