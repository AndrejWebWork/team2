import { CalendarDays, FileText, Leaf, Medal, ShieldCheck, TrendingUp, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'

// Аватар бои — детерминистички според userId (без hardcode-ирани корисници).
const COLORS = [
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
  'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700',
]

function hashIndex(str, mod) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % mod
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function LeaderboardPage() {
  const { leaderboardMonthly, auth, currentUserPoints, currentUserId, t } = useApp()

  const isAnon = !auth.email
  const myName = isAnon ? t('common.anonymousCitizen') : (auth.displayName || auth.email)
  const myColor = COLORS[hashIndex(String(currentUserId), COLORS.length)]
  const communityPoints = leaderboardMonthly.reduce((sum, e) => sum + (e.points || 0), 0)

  const profileFor = (entry) => {
    if (entry.userId === currentUserId) return { name: myName, avatar: isAnon ? '?' : initials(myName), color: myColor }
    const name = entry.name || entry.userId
    return { name, avatar: initials(name), color: COLORS[hashIndex(String(entry.userId), COLORS.length)] }
  }

  const EARN = [
    { icon: FileText, label: t('lead.earnReport'), pts: '+1', cls: 'text-sky-600 bg-sky-50 border-sky-100' },
    { icon: ShieldCheck, label: t('lead.earnResolved'), pts: '+3', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { icon: Leaf, label: t('lead.earnAction'), pts: '+1', cls: 'text-amber-600 bg-amber-50 border-amber-100' },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-slate-900'>
          <Trophy className='h-6 w-6 text-amber-500' />{t('lead.title')}
        </h1>
        <p className='mt-0.5 text-sm text-slate-500'>{t('lead.subtitle')}</p>
        <p className='mt-1.5 flex items-center gap-1.5 text-xs text-slate-400'>
          <CalendarDays className='h-3.5 w-3.5 shrink-0 text-slate-400' aria-hidden />
          <span>{t('lead.thisMonth')}</span>
        </p>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-1 p-4 text-center'>
            <span className='text-2xl font-extrabold tabular-nums text-emerald-700'>{currentUserPoints}</span>
            <span className='text-[11px] font-medium text-slate-500'>{t('lead.yourPoints')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-1 p-4 text-center'>
            <span className='text-2xl font-extrabold tabular-nums text-amber-600'>{communityPoints}</span>
            <span className='text-[11px] font-medium text-slate-500'>{t('lead.communityPoints')}</span>
          </CardContent>
        </Card>
      </div>

      {leaderboardMonthly.length > 0 ? (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Medal className='h-4 w-4 text-amber-500' />{t('lead.ranking')}
            </CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain scroll-smooth'>
              {leaderboardMonthly.map((entry) => {
                const place = 1 + leaderboardMonthly.filter((x) => x.points > entry.points).length
                const isMe = entry.userId === currentUserId
                const p = profileFor(entry)
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${isMe ? 'bg-emerald-50' : ''}`}
                  >
                    <span className='flex w-8 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-slate-400'>
                      {place}
                    </span>
                    <div className={`flex aspect-square h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none ${p.color}`}>
                      {p.avatar}
                    </div>
                    <span className={`flex-1 truncate text-sm font-semibold ${isMe ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {p.name}
                      {isMe && <span className='ml-1.5 text-xs font-normal text-emerald-500'>{t('lead.you')}</span>}
                    </span>
                    <div className='shrink-0 text-right'>
                      <span className='text-sm font-bold tabular-nums text-amber-600'>{entry.points}</span>
                      <span className='ml-1 text-xs text-slate-400'>{t('common.points')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-8 text-center'>
            <Trophy className='h-8 w-8 text-slate-300' />
            <p className='text-sm text-slate-500'>{t('lead.noPoints')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <TrendingUp className='h-4 w-4 text-emerald-500' />{t('lead.howToEarn')}
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-2 sm:grid-cols-3'>
          {EARN.map(({ icon: Icon, label, pts, cls }) => (
            <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${cls}`}>
              <Icon className='h-5 w-5 shrink-0' />
              <span className='flex-1 text-sm font-medium text-slate-700'>{label}</span>
              <span className='text-sm font-bold tabular-nums'>{pts}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
