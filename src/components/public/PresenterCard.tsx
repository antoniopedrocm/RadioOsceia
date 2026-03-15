import { Card, CardContent } from '@/components/ui/card';
import type { Presenter } from '@/types';

export function PresenterCard({ presenter }: { presenter: Presenter }) {
  return (
    <Card>
      <CardContent className="p-4">
        <img src={presenter.foto} alt={presenter.nome} className="mb-3 h-20 w-20 rounded-full object-cover" />
        <h3 className="font-semibold">{presenter.nome}</h3>
        <p className="text-sm text-muted-foreground">{presenter.bio}</p>
      </CardContent>
    </Card>
  );
}
