function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mkDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('mk-MK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reportStatus(report, t) {
  if (report.type === 'container') {
    return report.issueOpen === false || report.status === 'resolved'
      ? t('status.resolved')
      : t('status.pending')
  }
  if (report.status) return t(`status.${report.status}`)
  return t('status.pending')
}

function reportPhotos(report) {
  // Smell reports never include photos.
  if (report.type === 'smell') return []
  if (report.photos?.length) return report.photos.filter(Boolean)
  if (report.photo) return [report.photo]
  return []
}

function issueLabel(issue, t) {
  if (issue === 'full') return t('container.full')
  if (issue === 'smell') return t('container.smell')
  if (issue === 'broken') return t('container.broken')
  return issue || '—'
}

function row(label, value) {
  if (value == null || value === '' || value === '—') return ''
  return `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:13px;color:#0f172a">${value}</td></tr>`
}

function plainRow(label, value) {
  if (value == null || value === '' || value === '—') return ''
  return `${label}: ${value}\n`
}

/** Fetch image → data URL so paste into email keeps photos (not just remote links). */
async function embedPhotoAsDataUrl(src) {
  if (!src || String(src).startsWith('data:')) return src
  try {
    const res = await fetch(src, { cache: 'force-cache' })
    if (!res.ok) return src
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') || blob.size > 4_500_000) return src
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return src
  }
}

export function buildReportClipboardContent(report, t, extras = {}) {
  const typeLabel = t(`type.${report.type}`)
  const statusLabel = extras.statusLabel || reportStatus(report, t)
  const location = report.location || report.area || t('admin.unknownLocation')
  const municipality = report.municipality || t('admin.municipalityUnknown')
  const reportedBy = report.reportedBy || report.createdBy || t('common.anonymous')
  const photos = reportPhotos(report)

  const mapLink = report.lat != null
    ? `<a href="https://www.openstreetmap.org/?mlat=${Number(report.lat)}&mlon=${Number(report.lng)}#map=18/${Number(report.lat)}/${Number(report.lng)}" style="color:#0284c7">${t('admin.openMap')}</a>`
    : '—'

  const gps = report.lat != null
    ? `${Number(report.lat).toFixed(5)}, ${Number(report.lng).toFixed(5)}`
    : '—'

  let extraHtml = ''
  let extraPlain = ''

  if (report.description) {
    extraHtml += row(t('admin.desc'), escapeHtml(report.description))
    extraPlain += plainRow(t('admin.desc'), report.description)
  }
  if (report.message) {
    extraHtml += row(t('admin.message'), escapeHtml(report.message))
    extraPlain += plainRow(t('admin.message'), report.message)
  }
  if (report.intensity != null) {
    extraHtml += row(t('admin.smellIntensity'), `${report.intensity}/5`)
    extraPlain += plainRow(t('admin.smellIntensity'), `${report.intensity}/5`)
  }
  if (report.type === 'smell' && extras.clusterCount > 1) {
    const clusterText = t('admin.smellClusterDetail', {
      count: extras.clusterCount,
      sensor: extras.sensorName || t('admin.unknownLocation'),
    })
    extraHtml += row(t('admin.smellSensor'), escapeHtml(clusterText))
    extraPlain += plainRow(t('admin.smellSensor'), clusterText)
  }
  if (report.type === 'container') {
    extraHtml += row(t('admin.containerType'), escapeHtml(t(`containerKind.${report.kind || 'mesan'}`)))
    extraPlain += plainRow(t('admin.containerType'), t(`containerKind.${report.kind || 'mesan'}`))
    if (report.issue) {
      extraHtml += row(t('admin.problemType'), escapeHtml(issueLabel(report.issue, t)))
      extraPlain += plainRow(t('admin.problemType'), issueLabel(report.issue, t))
    }
  }
  if (report.resolvedAt) {
    extraHtml += row(t('admin.resolvedOn'), mkDate(report.resolvedAt))
    extraPlain += plainRow(t('admin.resolvedOn'), mkDate(report.resolvedAt))
  }

  const photoHtml = photos.length
    ? `<div style="margin:12px 0">${photos.map((src, idx) => `<div style="margin-bottom:8px"><img src="${src}" alt="${escapeHtml(t('photo.altPhotoFull', { n: idx + 1 }))}" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid #e2e8f0" /></div>`).join('')}</div>`
    : ''

  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:640px">
<h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(typeLabel)} · ${escapeHtml(statusLabel)}</h2>
<p style="margin:0 0 12px;font-size:13px;color:#64748b">EkoSkopje · ${mkDate(report.createdAt)}</p>
${photoHtml}
<table style="border-collapse:collapse;width:100%">
${row(t('table.location'), escapeHtml(location))}
${row(t('admin.municipality'), escapeHtml(municipality))}
${row('GPS', escapeHtml(gps))}
${row(t('admin.openMap'), mapLink)}
${row(t('table.status'), escapeHtml(statusLabel))}
${row(t('admin.reportedBy'), escapeHtml(reportedBy))}
${row(t('admin.date'), mkDate(report.createdAt))}
${extraHtml}
</table>
<p style="margin:16px 0 0;font-size:11px;color:#94a3b8">ID: ${escapeHtml(report.id || '—')}</p>
</div>`

  const plain = [
    `${typeLabel} · ${statusLabel}`,
    `EkoSkopje · ${mkDate(report.createdAt)}`,
    '',
    plainRow(t('table.location'), location),
    plainRow(t('admin.municipality'), municipality),
    plainRow('GPS', gps),
    plainRow(t('table.status'), statusLabel),
    plainRow(t('admin.reportedBy'), reportedBy),
    plainRow(t('admin.date'), mkDate(report.createdAt)),
    extraPlain,
    photos.length ? `${t('admin.photosCount', { n: photos.length })}\n` : '',
    `ID: ${report.id || '—'}`,
  ].join('\n').trim()

  return { html, plain }
}

async function writeClipboard(html, plain) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    return
  }

  const host = document.createElement('div')
  host.contentEditable = 'true'
  host.innerHTML = html
  host.style.position = 'fixed'
  host.style.left = '-9999px'
  document.body.appendChild(host)
  const range = document.createRange()
  range.selectNodeContents(host)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  document.execCommand('copy')
  document.body.removeChild(host)
}

export async function copyReportToClipboard(report, t, extras = {}) {
  const originalPhotos = reportPhotos(report)
  const embeddedPhotos = await Promise.all(originalPhotos.map(embedPhotoAsDataUrl))
  const { html, plain } = buildReportClipboardContent(
    { ...report, photos: embeddedPhotos, photo: embeddedPhotos[0] || '' },
    t,
    extras,
  )
  await writeClipboard(html, plain)
}
