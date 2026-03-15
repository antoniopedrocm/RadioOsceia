import { PageHeader } from '@/components/admin/PageHeader';
import { FormSection } from '@/components/admin/FormSection';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadPlaceholder } from '@/components/admin/UploadPlaceholder';

export function AdminMidiasPage() {
  return <div className="space-y-4"><PageHeader title="Gestão de Mídias" description="Cadastro de mídias YouTube e locais." action="Nova mídia" /><FormSection title="Dados da mídia"><Input placeholder="Título" /><Select><option>Tipo</option><option>Vídeo do YouTube</option></Select><Input placeholder="Origem" /><Input placeholder="URL YouTube" /><Input placeholder="Caminho local (mock)" /><Input placeholder="Thumbnail" /><Input placeholder="Duração" /><Select><option>Programa vinculado</option></Select><Select><option>Categoria</option></Select><Select><option>Instituição</option></Select><Select><option>Status</option></Select><Textarea placeholder="Observações" /></FormSection><UploadPlaceholder /></div>;
}
