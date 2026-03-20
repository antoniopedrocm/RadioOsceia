import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ProgramCard } from '@/components/public/ProgramCard';
import { PresenterCard } from '@/components/public/PresenterCard';
import { NowPlayingCard } from '@/components/public/NowPlayingCard';
import { UpcomingQueue } from '@/components/public/UpcomingQueue';
import { EmptyState, LoadingState } from '@/components/shared/LoadableMessage';
import { usePresenters, usePrograms } from '@/hooks/useRadioData';

export function HomePage() {
  const programsState = usePrograms();
  const presentersState = usePresenters();

  return (
    <div className="space-y-8">
      <section className="grid gap-5 rounded-2xl border bg-gradient-to-br from-primary/10 to-secondary/10 p-8 md:grid-cols-2">
        <div className="space-y-4"><h1 className="text-3xl font-bold">Rádio / Web TV Institucional</h1><p className="text-muted-foreground">Conteúdos de reflexão, estudo e acolhimento para toda a comunidade.</p><div className="flex flex-wrap gap-2"><Link to="/programacao"><Button>Ver programação</Button></Link><Link to="/como-ouvir"><Button variant="outline">Como ouvir</Button></Link><Link to="/admin/login"><Button variant="ghost">Entrar no painel</Button></Link></div></div>
        <img className="h-64 w-full rounded-xl object-cover" src="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900" alt="banner institucional" />
      </section>

      <div className="grid gap-4 md:grid-cols-2"><NowPlayingCard /><UpcomingQueue /></div>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Destaques de programas</h2>
        {programsState.isLoading ? (
          <LoadingState title="Carregando programas" description="Buscando os destaques disponíveis." />
        ) : programsState.errorMessage ? (
          <EmptyState
            title="Não foi possível carregar os programas"
            description={`${programsState.errorMessage} A página continuará disponível mesmo com o backend desligado.`}
            tone="warning"
          />
        ) : programsState.data.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {programsState.data.map((program) => (
              <motion.div key={program.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ProgramCard program={program} />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum programa encontrado" description="Assim que houver programas publicados, eles aparecerão aqui." />
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Apresentadores e pregadores</h2>
        {presentersState.isLoading ? (
          <LoadingState title="Carregando apresentadores" description="Buscando a equipe pública cadastrada." />
        ) : presentersState.errorMessage ? (
          <EmptyState
            title="Não foi possível carregar os apresentadores"
            description={`${presentersState.errorMessage} Verifique a disponibilidade do backend para ver os dados reais.`}
            tone="warning"
          />
        ) : presentersState.data.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {presentersState.data.map((presenter) => <PresenterCard key={presenter.id} presenter={presenter} />)}
          </div>
        ) : (
          <EmptyState title="Nenhum apresentador encontrado" description="Cadastre apresentadores no backend para preencher esta seção." />
        )}
      </section>
    </div>
  );
}
