import { PageHeader } from '@/components/admin/PageHeader';
import { FormSection } from '@/components/admin/FormSection';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function AdminPlayerPage() {
  return <div><PageHeader title="Configurações do Player" description="Preferências visuais e padrão do player fixo." /><FormSection title="Preferências"><Select><option>Posição do player</option></Select><Select><option>Modo padrão</option></Select><label className="flex items-center gap-2 text-sm">Exibir capa <Switch defaultChecked /></label><label className="flex items-center gap-2 text-sm">Exibir fila <Switch defaultChecked /></label><label className="flex items-center gap-2 text-sm">Autoplay visual <Switch /></label><Select><option>Tema claro/escuro</option></Select><Select><option>Texto botão padrão</option></Select></FormSection></div>;
}
