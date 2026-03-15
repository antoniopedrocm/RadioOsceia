interface ProgressProps { value: number }
export function Progress({ value }: ProgressProps) {
  return <div className="h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} /></div>;
}
