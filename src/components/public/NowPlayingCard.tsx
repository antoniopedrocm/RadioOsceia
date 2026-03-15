import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { queue } from '@/data/mockData';

export function NowPlayingCard() {
  const now = queue[0];
  return <Card><CardContent className="space-y-2 p-4"><Badge className="bg-success text-white">Ao vivo agora</Badge><h3 className="font-semibold">{now.titulo}</h3><p className="text-sm text-muted-foreground">{now.programa} • {now.tipo}</p></CardContent></Card>;
}
