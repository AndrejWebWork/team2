import { config } from '../config.js'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export function isEmailConfigured() {
  return Boolean(config.brevoApiKey && config.brevoSenderEmail)
}

const RESET_COPY = {
  mk: {
    subject: 'EkoSkopje — ресетирање на лозинка',
    intro: 'Применивме барање за нова лозинка за вашата EkoSkopje сметка.',
    action: 'Ресетирај лозинка',
    expiry: 'Линкот важи 1 час. Ако не сте го побарале ова, игнорирајте ја пораката.',
    footer: 'EkoSkopje — паметна еко платформа за Скопје',
  },
  en: {
    subject: 'EkoSkopje — password reset',
    intro: 'We received a request to reset the password for your EkoSkopje account.',
    action: 'Reset password',
    expiry: 'This link expires in 1 hour. If you did not request this, you can ignore this email.',
    footer: 'EkoSkopje — smart eco platform for Skopje',
  },
  sq: {
    subject: 'EkoSkopje — rivendosje e fjalëkalimit',
    intro: 'Kemi marrë një kërkesë për të rivendosur fjalëkalimin e llogarisë suaj EkoSkopje.',
    action: 'Rivendos fjalëkalimin',
    expiry: 'Lidhja vlen 1 orë. Nëse nuk e keni kërkuar këtë, injorojeni email-in.',
    footer: 'EkoSkopje — platformë e mençur ekologjike për Shkupin',
  },
}

function resetEmailHtml({ resetUrl, language }) {
  const copy = RESET_COPY[language] || RESET_COPY.mk
  return `<!DOCTYPE html>
<html lang="${language}">
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #d1fae5;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#065f46;">EkoSkopje</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">${copy.intro}</p>
          <a href="${resetUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">${copy.action}</a>
          <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#64748b;">${copy.expiry}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">${resetUrl}</p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #ecfdf5;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">${copy.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendPasswordResetEmail({ to, resetUrl, language = 'mk' }) {
  if (!isEmailConfigured()) {
    console.warn('[brevo] BREVO_API_KEY or BREVO_SENDER_EMAIL not set — password reset email skipped.')
    return false
  }

  const lang = ['mk', 'en', 'sq'].includes(language) ? language : 'mk'
  const copy = RESET_COPY[lang]

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: config.brevoSenderName, email: config.brevoSenderEmail },
      to: [{ email: to }],
      subject: copy.subject,
      htmlContent: resetEmailHtml({ resetUrl, language: lang }),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[brevo] send failed:', res.status, body)
    throw new Error('Испраќањето на email не успеа.')
  }

  return true
}
