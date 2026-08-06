import { config } from '../config.js'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export function isEmailConfigured() {
  return Boolean(config.brevoApiKey && config.brevoSenderEmail)
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Креативен, но сè уште transactional тон — mk / en / sq според јазикот во апликацијата.
const RESET_COPY = {
  mk: {
    subject: '🔑 Вашиот клуч назад кон Еко Скопје',
    preheader: 'Еден клик до нова лозинка — линкот важи 1 час.',
    greeting: 'Здраво,',
    headline: 'Да ја отклучиме повторно вашата сметка',
    intro: 'Некој (се надеваме вие) побара нова лозинка за Еко Скопје. Градот чека — а ние ви го подготвивме безбедниот пат назад.',
    cta: 'Задај нова лозинка',
    linkHint: 'Копчето не работи? Копирајте го целиот линк подолу и отворете го во прелистувач:',
    expiry: '⏱ Линкот е свеж само 1 час — потоа ќе треба ново барање.',
    ignore: 'Ако ова не сте го побарале вие, едноставно игнорирајте ја пораката. Вашата лозинка останува непроменета.',
    footer: 'Со еко поздрав, тимот на Еко Скопје',
  },
  en: {
    subject: '🔑 Your way back into Еко Скопје',
    preheader: 'One tap to a new password — this link is valid for 1 hour.',
    greeting: 'Hi there,',
    headline: 'Let’s unlock your account again',
    intro: 'Someone (hopefully you) asked for a new password for Еко Скопје. The city is waiting — here’s a safe path back in.',
    cta: 'Set a new password',
    linkHint: 'Button not working? Copy the full link below and open it in your browser:',
    expiry: '⏱ This link stays fresh for 1 hour only — after that you’ll need a new request.',
    ignore: 'If you didn’t ask for this, just ignore the email. Your password stays unchanged.',
    footer: 'With eco regards, the Еко Скопје team',
  },
  sq: {
    subject: '🔑 Rruga juaj për t’u kthyer në Еко Скопје',
    preheader: 'Një klik për fjalëkalim të ri — lidhja vlen 1 orë.',
    greeting: 'Përshëndetje,',
    headline: 'Le ta zhbllokojmë përsëri llogarinë tuaj',
    intro: 'Dikush (shpresojmë ju) ka kërkuar fjalëkalim të ri për Еко Скопје. Qyteti pret — ja rruga e sigurt për t’u kthyer.',
    cta: 'Vendos fjalëkalim të ri',
    linkHint: 'Butoni nuk funksionon? Kopjoni lidhjen e plotë më poshtë dhe hapeni në shfletues:',
    expiry: '⏱ Lidhja mbetet e freskët vetëm 1 orë — pas kësaj duhet kërkesë e re.',
    ignore: 'Nëse nuk e keni kërkuar ju, thjesht injorojeni email-in. Fjalëkalimi juaj mbetet i pandryshuar.',
    footer: 'Me përshëndetje ekologjike, ekipi i Еко Скопје',
  },
}

function resetEmailText({ resetUrl, language }) {
  const copy = RESET_COPY[language] || RESET_COPY.mk
  return [
    'Еко Скопје',
    '',
    copy.greeting,
    copy.headline,
    '',
    copy.intro,
    '',
    copy.cta + ':',
    resetUrl,
    '',
    copy.expiry,
    '',
    copy.ignore,
    '',
    copy.footer,
  ].join('\n')
}

function resetEmailHtml({ resetUrl, language }) {
  const copy = RESET_COPY[language] || RESET_COPY.mk
  const safeUrl = escapeHtml(resetUrl)
  // word-break + overflow-wrap: долгиот token URL да се гледа целосно на телефон.
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 28px 22px;text-align:center;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.02em;color:#ffffff;">Еко Скопје</div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.9);">Skopje · eco city</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:15px;color:#475569;">${escapeHtml(copy.greeting)}</p>
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(copy.headline)}</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#334155;">${escapeHtml(copy.intro)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;">
                <tr>
                  <td align="center" style="border-radius:12px;background:#059669;">
                    <a href="${safeUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
                      ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.45;color:#64748b;">${escapeHtml(copy.linkHint)}</p>
              <div style="margin:0 0 20px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <a href="${safeUrl}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="display:block;font-size:13px;line-height:1.5;color:#0369a1;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">
                  ${safeUrl}
                </a>
              </div>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#475569;">${escapeHtml(copy.expiry)}</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(copy.ignore)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
                ${escapeHtml(copy.footer)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
      sender: { name: `${config.brevoSenderName}`, email: config.brevoSenderEmail },
      to: [{ email: to }],
      subject: copy.subject,
      htmlContent: resetEmailHtml({ resetUrl, language: lang }),
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
