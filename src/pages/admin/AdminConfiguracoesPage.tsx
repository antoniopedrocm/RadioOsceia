import { PageHeader } from '@/components/admin/PageHeader';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

export function AdminConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Defina parâmetros institucionais e aparência do painel." />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <Input placeholder="Nome da instituição" />
          <Input placeholder="Logo (URL)" />
          <Input placeholder="Cor primária" />
          <Input placeholder="Cor secundária" />
          <Textarea className="md:col-span-2" placeholder="Texto institucional" />
          <Select>
            <option>Posição do player</option>
            <option>Rodapé fixo</option>
            <option>Canto inferior direito</option>
          </Select>
          <Select>
            <option>Tema visual</option>
            <option>Claro</option>
            <option>Escuro</option>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
