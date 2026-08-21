import { CalendarDays, FileText, Leaf, Medal, Send, ShieldCheck, TrendingUp, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AwardContactBubble } from '../components/AwardContactBubble'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { fetchLeaderboardAwards, sendLeaderboardAwardApi } from '../lib/api'
import { nextPointsResetLabel } from '../lib/pointsPeriod'
import { isSuperAdmin } from '../lib/roles'

const COLORS = [
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
  'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700',
]

const PODIUM = [
  { place: 2, ring: 'border-slate-300', badge: 'bg-slate-400', order: 'order-1', height: 'pt-6' },
  { place: 1, ring: 'border-amber-400', badge: 'bg-amber-500', order: 'order-2', height: 'pt-2' },
  { place: 3, ring: 'border-orange-300', badge: 'bg-orange-500', order: 'order-3', height: 'pt-8' },
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

function AdminAwardsPanel({ ranked, t, language }) {
  const top5 = ranked.slice(0, 5)
  const [awards, setAwards] = useState([])
  const [messages, setMessages] = useState({})
  const [busyPlace, setBusyPlace] = useState(null)
  const [feedback, setFeedback] = useState('')

  const loadAwards = useCallback(() => {
    fetchLeaderboardAwards()
      .then(setAwards)
      .catch(() => setAwards([]))
  }, [])

  useEffect(() => { loadAwards() }, [loadAwards])

  const awardByPlace = useMemo(() => {
    const map = new Map()
    awards.forEach((a) => map.set(a.place, a))
    return map
  }, [awards])

  async function sendAward(place, entry) {
    const message = String(messages[place] || '').trim()
    if (!message) {
      setFeedback(t('lead.awardMessageRequired'))
      return
    }
    setBusyPlace(place)
    setFeedback('')
    try {
      await sendLeaderboardAwardApi({
        place,
        email: entry.email || entry.userId,
        userId: entry.id || null,
        message,
      })
      setFeedback(t('lead.awardSent', { place, name: entry.name || entry.userId }))
      loadAwards()
    } catch (err) {
      setFeedback(err?.message || t('lead.awardSendFailed'))
    } finally {
      setBusyPlace(null)
    }
  }

  if (!top5.length) return null

  return (
    <Card className='border-amber-200'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Send className='h-4 w-4 text-amber-600' />{t('lead.adminAwardsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm text-slate-600'>{t('lead.adminAwardsDesc', { date: nextPointsResetLabel(language) })}</p>
        {top5.map((entry, idx) => {
          const place = idx + 1
          const existing = awardByPlace.get(place)
          return (
            <div key={`${entry.userId}-${place}`} className='rounded-xl border border-slate-200 p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-semibold text-slate-900'>
                  #{place} · {entry.name || entry.userId}
                  <span className='ml-2 font-normal text-slate-500'>{entry.points} {t('common.points')}</span>
                </p>
                {existing && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    existing.status === 'contact_submitted'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {existing.status === 'contact_submitted' ? t('lead.awardStatusContact') : t('lead.awardStatusPending')}
                  </span>
                )}
              </div>
              {existing?.status === 'contact_submitted' && (
                <p className='mt-2 text-xs text-slate-600'>
                  {existing.contactName} · {existing.contactPhone}
                  {existing.contactEmail ? ` · ${existing.contactEmail}` : ''}
                  {existing.contactNote ? ` — ${existing.contactNote}` : ''}
                </p>
              )}
              <textarea
                rows={2}
                maxLength={500}
                value={messages[place] ?? existing?.message ?? ''}
                onChange={(e) => setMessages((m) => ({ ...m, [place]: e.target.value }))}
                placeholder={t('lead.awardMessagePlaceholder', { place })}
                className='mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm'
              />
              <Button
                size='sm'
                className='mt-2'
                disabled={busyPlace === place}
                onClick={() => sendAward(place, entry)}
              >
                <Send className='h-3.5 w-3.5' />
                {busyPlace === place ? '…' : t('lead.awardSend')}
              </Button>
            </div>
          )
        })}
        {feedback && <p className='text-xs text-slate-600'>{feedback}</p>}
      </CardContent>
    </Card>
  )
}

export function LeaderboardPage() {
  const { leaderboardMonthly, auth, currentUserPoints, currentUserId, t, language } = useApp()

  const isAnon = !auth.email
  const myName = isAnon ? t('common.anonymousCitizen') : (auth.displayName || auth.email)
  const myColor = COLORS[hashIndex(String(currentUserId), COLORS.length)]
  const communityPoints = leaderboardMonthly.reduce((sum, e) => sum + (e.points || 0), 0)

  const ranked = useMemo(
    () => leaderboardMonthly.map((entry, index) => ({ ...entry, place: index + 1 })),
    [leaderboardMonthly],
  )
  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)

  const profileFor = (entry) => {
    if (entry.userId === currentUserId) return { name: myName, avatar: isAnon ? '?' : initials(myName), color: myColor }
    const name = entry.name || entry.userId
    return { name, avatar: initials(name), color: COLORS[hashIndex(String(entry.userId), COLORS.length)] }
  }

  const EARN = [
    { icon: FileText, label: t('lead.earnReport'), desc: t('lead.earnReportDesc'), pts: '+1', cls: 'text-sky-600 bg-sky-50 border-sky-100' },
    { icon: ShieldCheck, label: t('lead.earnResolved'), desc: t('lead.earnResolvedDesc'), pts: '+2', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { icon: Leaf, label: t('lead.earnAction'), desc: t('lead.earnActionDesc'), pts: '+1', cls: 'text-amber-600 bg-amber-50 border-amber-100' },
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
          <span>{t('lead.thisMonth', { date: nextPointsResetLabel(language) })}</span>
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

      {ranked.length > 0 ? (
        <>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Medal className='h-4 w-4 text-amber-500' />{t('lead.topThree')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex items-end justify-center gap-2 sm:gap-4'>
                {PODIUM.map(({ place, ring, badge, order, height }) => {
                  const entry = top3.find((e) => e.place === place)
                  if (!entry) {
                    return <div key={place} className={`hidden min-w-0 flex-1 ${order} sm:block`} />
                  }
                  const p = profileFor(entry)
                  const isMe = entry.userId === currentUserId
                  return (
                    <div key={place} className={`min-w-0 flex-1 ${order} ${height}`}>
                      <div className={`rounded-2xl border-2 ${ring} bg-slate-50/80 px-2 py-4 text-center sm:px-3`}>
                        <div className={`mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${badge}`}>
                          {place}
                        </div>
                        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${p.color}`}>
                          {p.avatar}
                        </div>
                        <p className={`mt-2 truncate text-sm font-semibold ${isMe ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {p.name}
                        </p>
                        <p className='mt-0.5 text-sm font-bold tabular-nums text-amber-600'>
                          {entry.points} <span className='text-xs font-normal text-slate-400'>{t('common.points')}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {rest.length > 0 && (
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-base'>{t('lead.allPlaces')}</CardTitle>
              </CardHeader>
              <CardContent className='overflow-x-auto p-0'>
                <table className='w-full min-w-[280px] text-left text-sm'>
                  <thead className='border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500'>
                    <tr>
                      <th className='px-4 py-2.5 font-semibold'>#</th>
                      <th className='px-4 py-2.5 font-semibold'>{t('lead.colUser')}</th>
                      <th className='px-4 py-2.5 text-right font-semibold'>{t('lead.colPoints')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((entry) => {
                      const isMe = entry.userId === currentUserId
                      const p = profileFor(entry)
                      return (
                        <tr
                          key={entry.userId}
                          className={`border-b border-slate-100 last:border-0 ${isMe ? 'bg-emerald-50' : ''}`}
                        >
                          <td className='px-4 py-3 font-bold tabular-nums text-slate-400'>{entry.place}</td>
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-2'>
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${p.color}`}>
                                {p.avatar}
                              </div>
                              <span className={`truncate font-semibold ${isMe ? 'text-emerald-700' : 'text-slate-800'}`}>
                                {p.name}
                                {isMe && <span className='ml-1.5 text-xs font-normal text-emerald-500'>{t('lead.you')}</span>}
                              </span>
                            </div>
                          </td>
                          <td className='px-4 py-3 text-right'>
                            <span className='font-bold tabular-nums text-amber-600'>{entry.points}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-8 text-center'>
            <Trophy className='h-8 w-8 text-slate-300' />
            <p className='text-sm text-slate-500'>{t('lead.noPoints')}</p>
          </CardContent>
        </Card>
      )}

      {isSuperAdmin(auth.role) && <AdminAwardsPanel ranked={ranked} t={t} language={language} />}

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <TrendingUp className='h-4 w-4 text-emerald-500' />{t('lead.howToEarn')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm leading-relaxed text-slate-600'>{t('lead.howToEarnIntro')}</p>
          <div className='grid gap-2 sm:grid-cols-3'>
            {EARN.map(({ icon: Icon, label, desc, pts, cls }) => (
              <div key={label} className={`rounded-xl border p-3 ${cls}`}>
                <div className='flex items-center gap-2'>
                  <Icon className='h-5 w-5 shrink-0' />
                  <span className='flex-1 text-sm font-semibold text-slate-800'>{label}</span>
                  <span className='text-sm font-bold tabular-nums'>{pts}</span>
                </div>
                <p className='mt-1.5 text-xs leading-relaxed text-slate-600'>{desc}</p>
              </div>
            ))}
          </div>
          <p className='text-xs leading-relaxed text-slate-500'>{t('lead.howToEarnNote', { date: nextPointsResetLabel(language) })}</p>
        </CardContent>
      </Card>

      <AwardContactBubble />
    </div>
  )
}
