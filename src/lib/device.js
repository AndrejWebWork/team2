// Стабилен идентитет на уредот за АНОНИМНИ корисници.
// Се генерира еднаш и се чува во localStorage, за да можат пријавите/поените на
// анонимен корисник да се кешираат и препознаат по уред (без најава).
const DEVICE_ID_KEY = 'ekoskopje.deviceId'

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `dev-${crypto.randomUUID()}`
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'dev-anonymous'
  }
}
