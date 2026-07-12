import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { useApp } from '../context/AppContext'

export function NotificationsPage() {
  const { notifications, unreadCount, markNotificationRead, markAllNotifications, t } = useApp()

  const groups = notifications.reduce((acc, n) => {
    acc[n.group] = [...(acc[n.group] || []), n]
    return acc
  }, {})

  const markOne = markNotificationRead
  const markAll = markAllNotifications
  // Групите се чуваат како локализирани стрингови; ги мапираме назад на клучеви.
  const groupLabel = (g) => (g === 'Денес' ? t('group.today') : g === 'Порано' ? t('group.earlier') : g)

  return (
    <div className='space-y-5'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='font-display text-2xl font-bold text-slate-900'>{t('notif.title')}</h1>
        <Button variant='outline' onClick={markAll} className='w-full sm:w-auto'>{t('notif.markAll')}</Button>
      </div>
      <p className='text-sm text-slate-500'>{t('notif.unread')} {unreadCount}</p>

      {notifications.length === 0 ? (
        <EmptyState title={t('notif.allClear')} description={t('notif.noNotifications')} />
      ) : (
        Object.keys(groups).map((group) => (
          <section key={group} className='space-y-2'>
            <h2 className='text-xs uppercase tracking-[0.2em] text-slate-500'>{groupLabel(group)}</h2>
            {groups[group].map((n, i) => (
              <Card key={n.id} className='stagger-item' style={{ '--i': i }}><CardContent className='p-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <p className='font-medium text-slate-800'>{n.title}</p>
                  {!n.read ? <Button variant='ghost' size='sm' onClick={() => markOne(n.id)}>{t('notif.read')}</Button> : <span className='text-xs text-slate-400'>{t('notif.read')}</span>}
                </div>
                <p className='text-sm text-slate-600'>{n.body}</p>
              </CardContent></Card>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
