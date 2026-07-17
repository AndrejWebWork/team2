import { Award, CalendarDays, Crown, FileText, Leaf, Medal, ShieldCheck, TrendingUp, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { fetchMyLeaderboardRank } from '../lib/api'

// Аватар бои — детерминистички според userId (без hardcode-ирани корисници).
const COLORS = [
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
  'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700',
]

// Стилови за медалите на подиумот (1., 2., 3. место).
const PODIUM = [
  { ring: 'ring-amber-300', bar: 'from-amber-400 to-amber-300', badge: 'bg-amber-400 text-white', h: 'h-24', icon: Crown, iconCls: 'text-amber-500' },
  { ring: 'ring-slate-300', bar: 'from-slate-300 to-slate-200', badge: 'bg-slate-400 text-white', h: 'h-16', icon: Medal, iconCls: 'text-slate-400' },
  { ring: 'ring-orange-300', bar: 'from-orange-400 to-orange-300', badge: 'bg-orange-400 text-white', h: 'h-12', icon: Award, iconCls: 'text-orange-500' },
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

  // Профил (име/иницијали/боја) од реален запис на leaderboard.
  const profileFor = (entry) => {
    if (entry.userId === currentUserId) return { name: myName, avatar: isAnon ? '?' : initials(myName), color: myColor }
    const name = entry.name || entry.userId
    return { name, avatar: initials(name), color: COLORS[hashIndex(String(entry.userId), COLORS.length)] }
  }

  // Точен ранг од базата за регистрирани корисници — МЕЃУ СИТЕ корисници,
  // не само меѓу топ 100 прикажани во листата.
  const [serverRank, setServerRank] = useState(null)
  useEffect(() => {
    if (isAnon || !auth.email) {
      setServerRank(null)
      return undefined
    }
    let cancelled = false
    fetchMyLeaderboardRank(auth.email).then((r) => {
      if (!cancelled && r && r.rank != null) setServerRank(r.rank)
      else if (!cancelled) setServerRank(null)
    })
    return () => { cancelled = true }
  }, [isAnon, auth.email])

  // Ранг = место меѓу сите корисници според поени; исти поени = исто место
  // (стандарден натпреварувачки ранг). Локална пресметка како резерва/за анонимни.
  const localRank = currentUserPoints > 0
    ? 1 + leaderboardMonthly.filter((e) => e.points > currentUserPoints).length
    : 0
  const myRank = serverRank ?? localRank
  const participants = leaderboardMonthly.length
  const distributed = leaderboardMonthly.reduce((sum, e) => sum + (e.points || 0), 0)

  // Напредок до следното место: првиот со строго повеќе поени од мене.
  const above = [...leaderboardMonthly].reverse().find((e) => e.points > currentUserPoints) || null
  const toNext = above ? Math.max(1, above.points - currentUserPoints + 1) : 0
  const progressPct = above && above.points > 0 ? Math.min(100, Math.round((currentUserPoints / above.points) * 100)) : 0

  const top3 = leaderboardMonthly.slice(0, 3)
  // Редослед на подиумот: 2., 1., 3. (централно највисок).
  const podiumOrder = [top3[1], top3[0], top3[2]].map((entry, i) => ({ entry, place: [2, 1, 3][i] }))
  const rest = leaderboardMonthly.slice(3)

  const EARN = [
    { icon: FileText, label: t('lead.earnReport'), pts: '+1', cls: 'text-sky-600 bg-sky-50 border-sky-100' },
    { icon: ShieldCheck, label: t('lead.earnResolved'), pts: '+3', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { icon: Leaf, label: t('lead.earnAction'), pts: '+1', cls: 'text-amber-600 bg-amber-50 border-amber-100' },
  ]

  return (
    <div className='space-y-6'>
      {/* Header */}
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

      {/* Stat row */}
      <div className='grid grid-cols-3 gap-3'>
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-1 p-4 text-center'>
            <span className='text-2xl font-extrabold tabular-nums text-slate-900'>{myRank > 0 ? `#${myRank}` : '—'}</span>
            <span className='text-[11px] font-medium text-slate-500'>{t('lead.yourRank')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-1 p-4 text-center'>
            <span className='flex items-center gap-1 text-2xl font-extrabold tabular-nums text-slate-900'>
              <Users className='h-4 w-4 text-slate-400' />{participants}
            </span>
            <span className='text-[11px] font-medium text-slate-500'>{t('lead.participants')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-1 p-4 text-center'>
            <span className='text-2xl font-extrabold tabular-nums text-amber-600'>{distributed}</span>
            <span className='text-[11px] font-medium text-slate-500'>{t('lead.distributed')}</span>
          </CardContent>
        </Card>
      </div>

      {/* Podium (top 3) */}
      {top3.length > 0 && (
        <Card className='overflow-hidden'>
          <CardContent className='p-5'>
            <div className='flex items-end justify-center gap-3 sm:gap-5'>
              {podiumOrder.map(({ entry, place }) => {
                if (!entry) return <div key={`empty-${place}`} className='w-20' />
                const p = profileFor(entry)
                const style = PODIUM[place - 1]
                const Icon = style.icon
                const isMe = entry.userId === currentUserId
                return (
                  <div key={entry.userId} className='flex w-20 flex-col items-center sm:w-24'>
                    <Icon className={`mb-1 h-5 w-5 ${style.iconCls}`} />
                    <div className='relative'>
                      <div className={`flex aspect-square h-14 w-14 items-center justify-center rounded-full text-base font-bold leading-none ring-4 ${p.color} ${style.ring} sm:h-16 sm:w-16`}>
                        {p.avatar}
                      </div>
                      <span className={`absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold leading-none tabular-nums shadow-sm ${style.badge}`}>
                        {place}
                      </span>
                    </div>
                    <p className={`mt-3 line-clamp-1 max-w-full text-center text-xs font-semibold ${isMe ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {p.name}
                    </p>
                    <p className='text-xs font-bold tabular-nums text-amber-600'>{entry.points}</p>
                    <div className={`mt-2 w-full rounded-t-lg bg-gradient-to-t ${style.bar} ${style.h}`} />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My score + progress */}
      <Card className='border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'>
        <CardContent className='p-5'>
          <div className='flex items-center gap-4'>
            <div className={`flex aspect-square h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none ${myColor}`}>
              {isAnon ? '?' : initials(myName)}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate font-semibold text-slate-800'>{myName}</p>
              <p className='text-xs text-slate-500'>{myRank > 0 ? t('lead.rankPlace', { n: myRank }) : t('lead.notRanked')}</p>
            </div>
            <div className='text-right'>
              <p className='text-3xl font-extrabold tabular-nums leading-none text-emerald-700'>{currentUserPoints}</p>
              <p className='mt-0.5 text-xs text-slate-400'>{t('common.points')}</p>
            </div>
          </div>

          {currentUserPoints > 0 ? (
            above ? (
              <div className='mt-4'>
                <div className='h-2 w-full overflow-hidden rounded-full bg-emerald-100'>
                  <div className='h-full rounded-full bg-emerald-500 transition-all duration-500' style={{ width: `${progressPct}%` }} />
                </div>
                <p className='mt-1.5 text-xs font-medium text-emerald-700'>{t('lead.toNext', { n: toNext })}</p>
              </div>
            ) : (
              <p className='mt-4 text-sm font-semibold text-emerald-700'>{t('lead.topRank')}</p>
            )
          ) : (
            <p className='mt-4 text-sm text-slate-500'>{t('lead.myScoreEmpty')}</p>
          )}
        </CardContent>
      </Card>

      {/* Full ranking (positions 4+) */}
      {rest.length > 0 && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Medal className='h-4 w-4 text-amber-500' />{t('lead.ranking')}
            </CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            {rest.map((entry) => {
              // Место според поени (исти поени = исто место), не по позиција во листата.
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
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {leaderboardMonthly.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-8 text-center'>
            <Trophy className='h-8 w-8 text-slate-300' />
            <p className='text-sm text-slate-500'>{t('lead.noPoints')}</p>
          </CardContent>
        </Card>
      )}

      {/* How to earn points */}
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
