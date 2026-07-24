import { config } from '../config.js'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export function isEmailConfigured() {
  return Boolean(config.brevoApiKey && config.brevoSenderEmail)
}

// Plain transactional copy — без marketing стил (Gmail Promotions таб).
const RESET_COPY = {
  mk: {
    subject: 'Барање за ресетирање на лозинка — EkoSkopje',
    intro: 'Применивме барање за нова лозинка за вашата EkoSkopje сметка.',
    linkLabel: 'Отворете ја следната адреса за да зададете нова лозинка:',
    expiry: 'Линкот важи 1 час.',
    ignore: 'Ако не сте го побарале ова, игнорирајте ја пораката.',
  },
  en: {
    subject: 'Password reset request — EkoSkopje',
    intro: 'We received a request to reset the password for your EkoSkopje account.',
    linkLabel: 'Open this link to set a new password:',
    expiry: 'This link expires in 1 hour.',
    ignore: 'If you did not request this, you can ignore this email.',
  },
  sq: {
    subject: 'Kërkesë për rivendosje fjalëkalimi — EkoSkopje',
    intro: 'Kemi marrë një kërkesë për të rivendosur fjalëkalimin e llogarisë suaj EkoSkopje.',
    linkLabel: 'Hapni këtë lidhje për të vendosur fjalëkalim të ri:',
    expiry: 'Lidhja vlen 1 orë.',
    ignore: 'Nëse nuk e keni kërkuar këtë, injorojeni email-in.',
  },
}

function resetEmailText({ resetUrl, language }) {
  const copy = RESET_COPY[language] || RESET_COPY.mk
  return [
    'EkoSkopje',
    '',
    copy.intro,
    '',
    copy.linkLabel,
    resetUrl,
    '',
    copy.expiry,
    '',
    copy.ignore,
    '',
    '— EkoSkopje',
  ].join('\n')
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
      sender: { name: `${config.brevoSenderName} Account`, email: config.brevoSenderEmail },
      to: [{ email: to }],
      subject: copy.subject,
      // Само plain text — Gmail полесно го третира како transactional (Primary/Updates).
      textContent: resetEmailText({ resetUrl, language: lang }),
      tags: ['password-reset', 'transactional'],
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[brevo] send failed:', res.status, body)
    throw new Error('Испраќањето на email не успеа.')
  }

  return true
}
