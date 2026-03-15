import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardStatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
}

export function DashboardStatCard({ title, value, icon: Icon, trend }: DashboardStatCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon size={16} />
          </span>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
      </CardContent>
    </Card>
  );
}
