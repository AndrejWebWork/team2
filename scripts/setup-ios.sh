#!/usr/bin/env bash
# ============================================================================
# EkoSkopje — подготовка на iOS проектот (се извршува САМО на macOS).
#
# Ова е turn-key скрипта: ја додава iOS платформата, ги внесува потребните
# дозволи (Info.plist), ги генерира иконите/splash и синхронизира сè.
#
# Предуслови на Mac:
#   • Xcode (App Store) + Command Line Tools:  xcode-select --install
#   • CocoaPods:  sudo gem install cocoapods   (или: brew install cocoapods)
#   • Node/npm + `npm install` веќе извршено во репото
#
# Употреба:
#   chmod +x scripts/setup-ios.sh
#   ./scripts/setup-ios.sh
# ============================================================================
set -euo pipefail

PLIST="ios/App/App/Info.plist"
PB=/usr/libexec/PlistBuddy

echo "==> 1/5  Веб билд (dist/)"
npm run build

if [ ! -d "ios" ]; then
  echo "==> 2/5  Додавање iOS платформа (cap add ios)"
  npx cap add ios
else
  echo "==> 2/5  iOS платформата веќе постои — прескокнато"
fi

echo "==> 3/5  Внесување дозволи во Info.plist"
set_plist() {
  local key="$1"; local value="$2"
  if $PB -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    $PB -c "Set :$key $value" "$PLIST"
  else
    $PB -c "Add :$key string $value" "$PLIST"
  fi
}

# Камера — за фотографирање на пријавите (getUserMedia во WKWebView).
set_plist "NSCameraUsageDescription" "EkoSkopje ја користи камерата за да фотографирате пријави (диви депонии, контејнери)."
# Локација — GPS за пријавите и најблискиот сензор.
set_plist "NSLocationWhenInUseUsageDescription" "EkoSkopje ја користи локацијата за да ја одреди адресата на вашата пријава и најблискиот сензор."

echo "==> 4/5  Генерирање икони и splash (assets/logo.png)"
npx @capacitor/assets generate --ios || echo "   (прескокнато — провери assets/logo.png)"

echo "==> 5/5  Синхронизација (cap sync ios) + pod install"
npx cap sync ios

echo ""
echo "✅ Готово. Отвори го проектот со:  npx cap open ios"
echo ""
echo "── iPhone од WINDOWS (Sideloadly, TEST без \$99/year) ──"
echo "   1. GitHub → Actions → „iOS Sideloadly IPA“ → Run workflow"
echo "   2. Download artifact: EkoSkopje-sideloadly-ipa (.ipa)"
echo "   3. https://sideloadly.io → install Sideloadly"
echo "   4. iPhone USB + Trust this computer"
echo "   5. Drag .ipa во Sideloadly + твој Apple ID (lukaangelevski123@gmail.com)"
echo "   6. Start → на iPhone: Settings → General → VPN & Device Management → Trust"
echo "   ⚠️  App истекува ~7 дена → повтори Sideloadly. Push НЕ работи без paid program."
echo ""
echo "── iPhone од Mac (Xcode, алтернатива) ──"
echo "   npm run build:ios && npx cap open ios → Personal Team → Run (⌘R)"
echo ""
echo "── Push (кога ќе платиш Apple Developer Program) ──"
echo "   • App.entitlements → aps-environment"
echo "   • APNs .p8 key во Firebase Console"
echo "   • GitHub Actions „iOS Build“ + secrets за signed .ipa"
