import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn('w-full', className)} {...props} />
}

function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn('flex h-10 w-full items-center justify-start gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1', className)} {...props} />
}

function TabsTrigger({ className, ...props }) {
  return <TabsPrimitive.Trigger className={cn('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm', className)} {...props} />
}

function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn('mt-4', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
