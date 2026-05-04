interface EmptyStateProps {
  title: string;
  description?: string;
  tone?: 'default' | 'warning';
}

export function EmptyState({ title, description, tone = 'default' }: EmptyStateProps) {
  const toneClasses =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-dashed text-muted-foreground';

  return (
    <div className={`rounded-xl border p-10 text-center ${toneClasses}`}>
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-2 text-sm opacity-90">{description}</p> : null}
    </div>
  );
}
