import { queue } from '@/data/mockData';

export function ScheduleTimeline() {
  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="w-16 text-sm text-muted-foreground">{item.inicio}</div>
          <div>
            <p className="font-medium">{item.titulo}</p>
            <p className="text-sm text-muted-foreground">{item.tipo} • {item.status}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
