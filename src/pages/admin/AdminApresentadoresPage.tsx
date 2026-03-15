import { PageHeader } from '@/components/admin/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

const presenters = [
  {
    name: 'Ana Clara',
    bio: 'Locutora e mediadora de conteúdo espiritual com foco em bem-estar diário.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    programs: 'Mensagem de Luz, Café com Esperança'
  },
  {
    name: 'Rafael Dias',
    bio: 'Jornalista e apresentador de entrevistas com convidados especiais.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    programs: 'Jornal da Esperança'
  }
];

export function AdminApresentadoresPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Apresentadores" description="Gerencie equipe, bios e vínculo com programas." action="Novo apresentador" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {presenters.map((presenter) => (
          <Card key={presenter.name}>
            <CardContent className="space-y-3 p-4">
              <img src={presenter.image} alt={presenter.name} className="h-20 w-20 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold">{presenter.name}</h3>
                <p className="text-sm text-muted-foreground">{presenter.bio}</p>
              </div>
              <p className="text-xs text-muted-foreground">Programas: {presenter.programs}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
