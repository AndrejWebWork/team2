import { Capacitor } from '@capacitor/core'

/**
 * iOS: експлицитно барај дозволи од JS (дополнително на AppDelegate).
 * AppDelegate е примарниот извор — ова е backup ако native bootstrap веќе
 * ги побарал (тогаш iOS нема повторно да праша).
 */
export async function bootstrapIosPermissions() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return

  // Кратка пауза — прозорецот мора да е активен за системскиот дијалог.
  await new Promise((r) => setTimeout(r, 1500))

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.requestPermissions()
  } catch { /* plugin / веќе одлучено */ }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.requestPermissions()
  } catch { /* Sideloadly / без APS — локалните се доволни за дијалог */ }

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const perm = await Geolocation.checkPermissions()
    if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
      await Geolocation.requestPermissions()
    }
  } catch { /* AppDelegate веќе побарал / services off */ }
}
