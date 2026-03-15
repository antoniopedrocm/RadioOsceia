import { Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

const scheduleItems = [
  { time: '08:00', title: 'Momento de Oração', type: 'Introdução', source: 'Áudio local', status: 'current' },
  { time: '09:00', title: 'Mensagem de Luz', type: 'Programa', source: 'Vídeo YouTube', status: 'next' },
  { time: '10:30', title: 'Vinheta Institucional', type: 'Vinheta', source: 'Áudio local', status: 'upcoming' }
];

export function ScheduleAdminPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-xs">
          <option>Segunda-feira</option>
          <option>Terça-feira</option>
          <option>Quarta-feira</option>
          <option>Quinta-feira</option>
          <option>Sexta-feira</option>
          <option>Sábado</option>
          <option>Domingo</option>
        </Select>
        <Button className="gap-2">
          <Plus size={16} /> Novo Agendamento
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Timeline de programação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduleItems.map((item) => (
              <div key={item.time} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-primary" />
                    <p className="font-semibold">{item.time}</p>
                    {item.status === 'current' && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">No ar agora</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Pencil size={14} /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                      <Trash2 size={14} /> Remover
                    </Button>
                  </div>
                </div>
                <p className="mt-2 font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.type} • {item.source}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-muted-foreground">Tocando agora</p>
              <p className="font-semibold">Momento de Oração</p>
            </div>
            <div>
              <p className="text-muted-foreground">Próximo conteúdo</p>
              <p className="font-medium">Mensagem de Luz</p>
            </div>
            <div>
              <p className="text-muted-foreground">Origem da mídia</p>
              <p className="font-medium">Vídeo YouTube</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium">Programa</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
