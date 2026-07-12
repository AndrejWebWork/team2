// Ограничувања за фотографии договорени со Град Скопје (состанок 04.06.2026)
export const MAX_PHOTOS = 6
export const MAX_DIMENSION = 1600 // макс. резолуција (подолга страна во px)
export const MIN_DIMENSION = 480 // мин. препорачана резолуција (подолга страна во px)
export const JPEG_QUALITY = 0.7 // компресија за помала меморија
export const MAX_FILE_BYTES = 1.5 * 1024 * 1024 // ~1.5 MB по фотографија

// Проценка на големина на dataURL (base64) во бајти.
export function dataUrlBytes(dataUrl) {
  const i = dataUrl.indexOf(',')
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor((b64.length * 3) / 4)
}

// Смалува извор (video/canvas/img) на макс. резолуција и враќа компресиран JPEG dataURL.
export function compressFromSource(source, srcW, srcH) {
  const longSide = Math.max(srcW, srcH)
  const scale = longSide > MAX_DIMENSION ? MAX_DIMENSION / longSide : 1
  const w = Math.round(srcW * scale)
  const h = Math.round(srcH * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(source, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), width: w, height: h }
}

// Компресира фајл од галерија (File/Blob) → JPEG dataURL според истите правила
// (макс. 1600px, quality 0.7). Гарантира дека сликата останува под backend
// лимитот (3 MB) без разлика колку е голема оригиналната фотографија.
export function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const { dataUrl } = compressFromSource(img, img.naturalWidth, img.naturalHeight)
        resolve(dataUrl)
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Invalid image file'))
    }
    img.src = url
  })
}
