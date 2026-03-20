import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadableMessageProps {
  title: string;
  description?: string;
  tone?: 'default' | 'warning';
  compact?: boolean;
}

export function LoadingState({ title = 'Carregando...', description, compact = false }: Omit<LoadableMessageProps, 'tone'>) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-dashed bg-muted/50 p-4 text-sm', compact && 'p-3')}>
      <Loader2 className="mt-0.5 size-4 animate-spin text-primary" />
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, tone = 'default', compact = false }: LoadableMessageProps) {
  return (
    <div className={cn(
      'rounded-lg border border-dashed p-4 text-sm',
      tone === 'warning' ? 'border-amber-300 bg-amber-50/80 text-amber-950' : 'bg-muted/40 text-foreground',
      compact && 'p-3'
    )}>
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('mt-0.5 size-4', tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground')} />
        <div>
          <p className="font-medium">{title}</p>
          {description && <p className={cn(tone === 'warning' ? 'text-amber-800/90' : 'text-muted-foreground')}>{description}</p>}
        </div>
      </div>
    </div>
  );
}
