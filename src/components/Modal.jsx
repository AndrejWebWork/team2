import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

// Портал во <body>: transform-анимациите на страниците го расипуваат fixed.
export function Modal({ title, open, onClose, children }) {
  if (!open) return null
  return createPortal(
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-4 sm:items-center'>
      <div className='w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-lg font-semibold text-slate-800'>{title}</h3>
          <button onClick={onClose} className='rounded-md p-1 text-slate-500 hover:bg-slate-100'><X className='h-4 w-4' /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
