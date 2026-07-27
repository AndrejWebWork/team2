import { Capacitor } from '@capacitor/core'

/**
 * Backup only — native AppDelegate owns the first prompts (sequential).
 * Runs late so it does NOT race with the system dialogs on launch.
 */
export async function bootstrapIosPermissions() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return

  // AppDelegate asks at ~1.2s (notif → location). Wait until that chain can finish.
  await new Promise((r) => setTimeout(r, 8000))

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'prompt' || current.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions()
    }
  } catch { /* */ }

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const perm = await Geolocation.checkPermissions()
    if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
      await Geolocation.requestPermissions()
    }
  } catch { /* */ }
}
