import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { NowPlayingResponse } from '@/types/api';

export function NowPlayingCard() {
  const [data, setData] = useState<NowPlayingResponse['nowPlaying'] | null>(null);

  useEffect(() => {
    api.get<NowPlayingResponse>('/public/institutions/osceia/now-playing')
      .then((response) => setData(response.nowPlaying))
      .catch(() => setData(null));
  }, []);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <Badge className="bg-success text-white">Ao vivo agora</Badge>
        <h3 className="font-semibold">{data?.title ?? 'Sem conteúdo no ar'}</h3>
        <p className="text-sm text-muted-foreground">{data ? `${data.media.title} • ${data.media.sourceType}` : 'Aguardando programação'}</p>
      </CardContent>
    </Card>
  );
}
