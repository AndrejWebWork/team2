import { Capacitor } from '@capacitor/core'

/**
 * Backup only — native AppDelegate owns the first prompts (sequential).
 * Runs late so it does NOT race with the system dialogs on launch.
 */
export async function bootstrapIosPermissions() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return

  await new Promise((r) => setTimeout(r, 6000))

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'prompt' || current.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions()
    }
  } catch { /* */ }
}
