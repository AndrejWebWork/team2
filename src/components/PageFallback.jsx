import { Loader2 } from 'lucide-react'

// Лесен приказ додека се вчитува „парчето“ (chunk) на страницата (code-splitting).
export function PageFallback() {
  return (
    <div className='flex min-h-[40vh] items-center justify-center' role='status' aria-live='polite'>
      <Loader2 className='h-6 w-6 animate-spin text-emerald-500' />
    </div>
  )
}
