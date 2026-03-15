import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

interface UpNextItem {
  id: string;
  title: string;
  startTime: string;
}

export function UpcomingQueue() {
  const [items, setItems] = useState<UpNextItem[]>([]);

  useEffect(() => {
    api.get<UpNextItem[]>('/public/institutions/osceia/up-next')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 font-semibold">Em seguida</h3>
        <div className="space-y-2">
          {items.length ? items.map((item) => (
            <div key={item.id} className="flex justify-between rounded-md bg-muted p-2 text-sm">
              <span>{item.title}</span>
              <span>{item.startTime}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Sem próximos itens.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
