import { PageHeader } from '@/components/admin/PageHeader';
import { queue } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function AdminFilaPage() {
  return <div className="space-y-4"><PageHeader title="Fila de Reprodução" description="Painel no ar agora e próximos itens." /><div className="flex flex-wrap gap-2"><Button>Iniciar</Button><Button variant="outline">Pausar</Button><Button variant="outline">Avançar</Button><Button variant="secondary">Forçar conteúdo</Button><Button variant="ghost">Ativar vinheta</Button></div><div className="grid gap-3">{queue.map((q) => <Card key={q.id}><CardContent className="flex items-center justify-between p-4"><div><p className="font-medium">{q.titulo}</p><p className="text-sm text-muted-foreground">{q.programa} • {q.tipo}</p></div><p className="text-sm">{q.status}</p></CardContent></Card>)}</div></div>;
}
