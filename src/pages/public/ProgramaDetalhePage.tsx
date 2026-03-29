import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { usePrograms } from '@/hooks/useRadioData';

export function ProgramaDetalhePage() {
  const { id } = useParams();
  const programsState = usePrograms();

  const program = useMemo(
    () => programsState.data.find((item) => item.id === id) ?? programsState.data[0],
    [id, programsState.data]
  );

  if (programsState.isLoading) {
    return <LoadingState title="Carregando programa" description="Buscando dados do programa no Firestore." />;
  }

  if (programsState.errorMessage || !program) {
    return <EmptyState title="Programa indisponível" description={programsState.errorMessage ?? 'Programa não encontrado.'} tone="warning" />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <img src={program.capa} alt={program.titulo} className="h-72 w-full rounded-xl object-cover" />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{program.titulo}</h1>
        <p className="text-muted-foreground">{program.descricao}</p>
        <div className="flex gap-2"><Badge>{program.categoria}</Badge><Badge className="bg-muted">{program.origem}</Badge></div>
        <p className="text-sm">Apresentador: <strong>{program.apresentador}</strong></p>
        <p className="text-sm">Horários: consultar grade semanal</p>
        <Button>Ouvir / Assistir</Button>
      </div>
    </div>
  );
}
