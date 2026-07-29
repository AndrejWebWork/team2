import { Leaf, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { isAdminRole } from '../lib/roles'

export function AuthLoadingPage() {
  const navigate = useNavigate()
  const { auth, setAuth, t } = useApp()
  const [step, setStep] = useState('checkingSession')

  useEffect(() => {
    const t1 = setTimeout(() => setStep('loadingRole'), 800)
    const t2 = setTimeout(() => {
      // Осигурај се дека сесијата е автентицирана (спречува redirect-loop назад тука).
      setAuth((prev) => ({ ...prev, isAuthenticated: true, isAnonymous: false }))
      if (isAdminRole(auth.role)) return navigate('/admin-desk', { replace: true })
      if (auth.role === 'organization') return navigate('/community', { replace: true })
      return navigate('/home', { replace: true })
    }, 1700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [auth, navigate])

  return (
    <div className='flex min-h-screen items-center justify-center bg-transparent p-4 app-safe-page'>
      <Card className='w-full max-w-md border-white/70 bg-white/75 backdrop-blur-xl'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 text-emerald-700'>
            <Leaf className='h-6 w-6' />
          </div>
          <CardTitle className='font-display text-4xl'>Еко Скопје</CardTitle>
        </CardHeader>
        <CardContent className='text-center'>
          <p className='text-base text-slate-600'>{t(`auth.${step}`)}</p>
          <div className='mx-auto mt-5 h-2 w-56 overflow-hidden rounded-full bg-slate-200'>
            <div className='h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-emerald-500 to-sky-500' />
          </div>
          <p className='mt-4 inline-flex items-center gap-1 text-xs text-slate-500'><ShieldCheck className='h-3.5 w-3.5' />{t('auth.secureDemo')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
