#!/bin/bash
# ============================================
# SHALA Browser — Linux Desktop Entry Kurulumu
# ============================================
# Bu script .desktop dosyasını mevcut proje yoluna göre
# düzenler ve sisteme (uygulama menüsü + dock) kaydeder.

set -e

# Bu script'in bulunduğu klasörün bir üst dizini = proje kök dizini
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 Proje dizini: $APP_DIR"

# Gerekli dosyaların varlığını kontrol et
if [ ! -f "$APP_DIR/main.js" ]; then
  echo "❌ Hata: $APP_DIR/main.js bulunamadı."
  echo "   Bu script'i 'build' klasörünün içinden, proje kökünün altından çalıştırdığından emin ol."
  exit 1
fi

if [ ! -f "$APP_DIR/build/icon.png" ]; then
  echo "❌ Hata: $APP_DIR/build/icon.png bulunamadı."
  exit 1
fi

ELECTRON_BIN="$APP_DIR/node_modules/.bin/electron"
if [ ! -f "$ELECTRON_BIN" ]; then
  echo "❌ Hata: Electron binary bulunamadı: $ELECTRON_BIN"
  echo "   Önce 'npm install' çalıştırdığından emin ol."
  exit 1
fi

# electron/cli.js bir node script'i (shebang: #!/usr/bin/env node).
# GNOME Shell gibi masaüstü ortamları uygulamaları minimal bir
# ortamda başlatır ve .bashrc/.profile okumaz — bu yüzden nvm ile
# kurulu node PATH'te bulunamayabilir. Bu yüzden node'un tam yolunu
# burada tespit edip Exec satırına doğrudan gömüyoruz.
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "❌ Hata: 'node' komutu bulunamadı (which/command -v boş döndü)."
  echo "   Node.js kurulu olduğundan ve PATH'te olduğundan emin ol."
  exit 1
fi
echo "🟢 node bulundu: $NODE_BIN"

ELECTRON_CLI="$APP_DIR/node_modules/electron/cli.js"
if [ ! -f "$ELECTRON_CLI" ]; then
  echo "❌ Hata: $ELECTRON_CLI bulunamadı."
  exit 1
fi

DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"

DESKTOP_FILE="$DESKTOP_DIR/shala-browser.desktop"

echo "✍️  Desktop dosyası oluşturuluyor: $DESKTOP_FILE"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=SHALA Browser
GenericName=Web Browser
Comment=Dardania Kingdom Royal Web Browser
Exec=bash -c 'cd "$APP_DIR" && "$NODE_BIN" "$ELECTRON_CLI" "$APP_DIR"'
Icon=$APP_DIR/build/icon.png
Terminal=false
Categories=Network;WebBrowser;
StartupWMClass=shala-browser
StartupNotify=true
EOF

chmod +x "$DESKTOP_FILE"

echo "🔄 Masaüstü veritabanı güncelleniyor..."
if command -v update-desktop-database &> /dev/null; then
  update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo "🎨 İkon cache temizleniyor..."
if command -v gtk-update-icon-cache &> /dev/null; then
  gtk-update-icon-cache -f "$HOME/.local/share/icons" 2>/dev/null || true
fi

echo ""
echo "✅ Kurulum tamamlandı!"
echo ""
echo "Şimdi yapman gerekenler:"
echo "  1. Açık olan SHALA Browser pencerelerini kapat"
echo "  2. Uygulama menüsünden 'SHALA Browser' ara ve aç"
echo "     (Dock'a sabitlemek için üzerine sağ tık → Favorilere Ekle / Pin to Dock)"
echo ""
echo "Not: Eğer GNOME kullanıyorsan oturumu kapatıp açman gerekebilir,"
echo "     bazı masaüstü ortamları icon cache'i hemen yenilemez."
