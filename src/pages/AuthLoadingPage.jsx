import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { GRB_SRC } from '../lib/brand'
import { isAdminRole } from '../lib/roles'

export function AuthLoadingPage() {
  const navigate = useNavigate()
  const { auth, setAuth, t } = useApp()
  const [step, setStep] = useState('checkingSession')
  const authRef = useRef(auth)
  authRef.current = auth

  useEffect(() => {
    const t1 = setTimeout(() => setStep('loadingRole'), 800)
    const t2 = setTimeout(() => {
      const current = authRef.current
      // Задржи ја анонимноста ако нема е-пошта; само означи сесија како готова.
      setAuth((prev) => ({
        ...prev,
        isAuthenticated: true,
        isAnonymous: !prev.email,
      }))
      if (isAdminRole(current.role)) return navigate('/admin-desk', { replace: true })
      if (current.role === 'organization') return navigate('/community', { replace: true })
      return navigate('/home', { replace: true })
    }, 1700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // Само еднаш при mount — не ресетирај ги тајмерите при auth промени.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setAuth])

  return (
    <div className='flex min-h-screen items-center justify-center bg-transparent p-4 app-safe-page'>
      <Card className='w-full max-w-md border-white/70 bg-white/75 backdrop-blur-xl'>
        <CardHeader className='text-center'>
          <img
            src={GRB_SRC}
            alt={t('brand.coatAlt')}
            className='mx-auto mb-3 h-16 w-auto object-contain'
            draggable={false}
          />
          <CardTitle className='font-display text-4xl'>Еко Скопје</CardTitle>
          <p className='mt-1 text-xs font-medium text-slate-400'>{t('brand.cityOfSkopje')}</p>
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
