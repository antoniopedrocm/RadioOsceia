import { Card, CardContent } from '@/components/ui/card';
import { queue } from '@/data/mockData';

export function UpcomingQueue() {
  return <Card><CardContent className="p-4"><h3 className="mb-3 font-semibold">Em seguida</h3><div className="space-y-2">{queue.slice(1).map((q) => <div key={q.id} className="flex justify-between rounded-md bg-muted p-2 text-sm"><span>{q.titulo}</span><span>{q.inicio}</span></div>)}</div></CardContent></Card>;
}
