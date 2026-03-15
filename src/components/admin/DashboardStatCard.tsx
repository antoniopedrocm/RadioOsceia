import { Card, CardContent } from '@/components/ui/card';

export function DashboardStatCard({ title, value }: { title: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}
