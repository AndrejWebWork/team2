import { Capacitor } from '@capacitor/core'

// ============================================================================
// Обвивка за телефонски нотификации.
//   • Локални нотификации (@capacitor/local-notifications): се појавуваат ВЕДНАШ
//     на уредот (пр. „Пријавата е примена"). Работат без надворешен сервер.
//   • Push (@capacitor/push-notifications): FCM token (Android + iOS преку Firebase SDK)
// На веб сите функции тивко не прават ништо (noop), па истиот код важи насекаде.
// ============================================================================

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

let localPermissionAsked = false

// Локална нотификација на уредот (веднаш). На веб: noop.
export async function scheduleLocalNotification({ title, body }) {
  if (!isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (!localPermissionAsked) {
      localPermissionAsked = true
      const perm = await LocalNotifications.requestPermissions()
      if (perm.display !== 'granted') return
      try {
        await LocalNotifications.createChannel({
          id: 'ekoskopje',
          name: 'EkoSkopje',
          description: 'Известувања за настани и пријави',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        })
      } catch { /* iOS */ }
    }
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 2147483000) + 1,
        title,
        body: body || '',
        schedule: { at: new Date(Date.now() + 150) },
        channelId: 'ekoskopje',
      }],
    })
  } catch {
    /* plugin недостапен / одбиена дозвола — тивко игнорирај */
  }
}

const PUSH_CHANNEL = {
  id: 'ekoskopje',
  name: 'EkoSkopje',
  description: 'Известувања за настани и пријави',
  importance: 5,
  visibility: 1,
  sound: 'default',
  vibration: true,
}

// Регистрира push (FCM) и го враќа токенот преку onToken. Слуша и за примени
// нотификации додека апликацијата е отворена. На веб: noop.
export async function registerPushNotifications({ onToken, onReceived } = {}) {
  if (!isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return

    // Android 8+: канал со HIGH importance — инаку FCM може тивко да ги крие.
    try {
      await PushNotifications.createChannel(PUSH_CHANNEL)
    } catch { /* iOS нема канали */ }

    PushNotifications.addListener('registration', (token) => {
      if (onToken && token?.value) onToken(token.value)
    })
    PushNotifications.addListener('registrationError', () => { /* игнорирај */ })
    if (onReceived) {
      PushNotifications.addListener('pushNotificationReceived', (n) => onReceived(n))
    }
    await PushNotifications.register()
  } catch {
    /* Firebase/plugin не е конфигуриран — тивко игнорирај */
  }
}
