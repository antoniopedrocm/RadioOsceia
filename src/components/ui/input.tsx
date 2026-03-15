import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-10 w-full rounded-md border bg-card px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />;
}
