import { PageHeader } from '@/components/admin/PageHeader';
import { FormSection } from '@/components/admin/FormSection';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

export function AdminInstituicoesPage() {
  return <div><PageHeader title="Configurações da Instituição" description="Branding por instituição e links principais." /><FormSection title="Identidade"><Input placeholder="Nome" /><Input placeholder="Logotipo (URL)" /><Input placeholder="Cor primária" /><Input placeholder="Cor secundária" /><Input placeholder="Favicon" /><Input placeholder="Banner principal" /><Textarea placeholder="Texto institucional" /><Input placeholder="Links principais" /><Select><option>Status</option></Select></FormSection></div>;
}
