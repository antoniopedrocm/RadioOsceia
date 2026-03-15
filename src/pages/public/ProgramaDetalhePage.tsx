import { useParams } from 'react-router-dom';
import { programs } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function ProgramaDetalhePage() {
  const { id } = useParams();
  const program = programs.find((p) => p.id === id) ?? programs[0];
  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <img src={program.capa} alt={program.titulo} className="h-72 w-full rounded-xl object-cover" />
      <div className="space-y-3"><h1 className="text-2xl font-semibold">{program.titulo}</h1><p className="text-muted-foreground">{program.descricao}</p><div className="flex gap-2"><Badge>{program.categoria}</Badge><Badge className="bg-muted">{program.origem}</Badge></div><p className="text-sm">Apresentador: <strong>{program.apresentador}</strong></p><p className="text-sm">Horários: seg/qua/sex às 19h</p><Button>Ouvir / Assistir</Button></div>
    </div>
  );
}
