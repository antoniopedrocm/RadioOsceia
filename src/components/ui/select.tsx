import { cn } from '@/lib/utils';
import type { SelectHTMLAttributes } from 'react';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 w-full rounded-md border bg-card px-3 text-sm', className)} {...props} />;
}
