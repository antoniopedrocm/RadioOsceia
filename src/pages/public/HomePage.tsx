import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProgramCard } from '@/components/public/ProgramCard';
import { PresenterCard } from '@/components/public/PresenterCard';
import { NowPlayingCard } from '@/components/public/NowPlayingCard';
import { UpcomingQueue } from '@/components/public/UpcomingQueue';
import { api } from '@/lib/api';
import type { Presenter, Program } from '@/types';

interface ApiProgram {
  id: string;
  title: string;
  shortDescription?: string;
  coverUrl?: string;
  category?: { name: string } | null;
  presenter?: { name: string } | null;
  institution?: { name: string } | null;
}

interface ApiPresenter {
  id: string;
  name: string;
  shortBio?: string;
  photoUrl?: string;
}

export function HomePage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [presenters, setPresenters] = useState<Presenter[]>([]);

  useEffect(() => {
    api.get<ApiProgram[]>('/public/institutions/osceia/programs').then((list) => {
      setPrograms(list.map((item) => ({
        id: item.id,
        titulo: item.title,
        categoria: item.category?.name ?? 'Sem categoria',
        apresentador: item.presenter?.name ?? 'Não definido',
        duracao: '-',
        origem: 'YouTube',
        instituicao: 'OSCEIA',
        descricao: item.shortDescription ?? '',
        capa: item.coverUrl ?? 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900'
      })));
    }).catch(() => setPrograms([]));

    api.get<ApiPresenter[]>('/public/institutions/osceia/presenters').then((list) => {
      setPresenters(list.map((item) => ({
        id: item.id,
        nome: item.name,
        bio: item.shortBio ?? '',
        foto: item.photoUrl ?? 'https://i.pravatar.cc/300',
        programas: []
      })));
    }).catch(() => setPresenters([]));
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 rounded-2xl border bg-gradient-to-br from-primary/10 to-secondary/10 p-8 md:grid-cols-2">
        <div className="space-y-4"><h1 className="text-3xl font-bold">Rádio / Web TV Institucional</h1><p className="text-muted-foreground">Conteúdos de reflexão, estudo e acolhimento para toda a comunidade.</p><div className="flex flex-wrap gap-2"><Link to="/programacao"><Button>Ver programação</Button></Link><Link to="/como-ouvir"><Button variant="outline">Como ouvir</Button></Link><Link to="/admin/login"><Button variant="ghost">Entrar no painel</Button></Link></div></div>
        <img className="h-64 w-full rounded-xl object-cover" src="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=900" alt="banner institucional" />
      </section>
      <div className="grid gap-4 md:grid-cols-2"><NowPlayingCard /><UpcomingQueue /></div>
      <section><h2 className="mb-4 text-xl font-semibold">Destaques de programas</h2><div className="grid gap-4 md:grid-cols-3">{programs.map((p) => <motion.div key={p.id} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}><ProgramCard program={p} /></motion.div>)}</div></section>
      <section><h2 className="mb-4 text-xl font-semibold">Apresentadores e pregadores</h2><div className="grid gap-4 md:grid-cols-3">{presenters.map((p) => <PresenterCard key={p.id} presenter={p} />)}</div></section>
    </div>
  );
}
