import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description: string;
  action?: string;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <Button>{action}</Button>}
    </div>
  );
}
