import { Button } from '@/components/ui/button';

export function PageHeader({ title, description, action }: { title: string; description: string; action?: string }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>{action && <Button>{action}</Button>}</div>;
}
