import { FilterBar } from '@/components/admin/FilterBar';
import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';
import { FormSection } from '@/components/admin/FormSection';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function AdminProgramasPage() {
  return <div className="space-y-4"><PageHeader title="Gestão de Programas" description="CRUD visual de programas institucionais." action="Novo programa" /><FilterBar /><DataTable headers={['Título','Categoria','Apresentador','Status']} rows={[['Mensagem de Luz','Reflexão','Ana Clara','Ativo'],['Estudo do Evangelho','Estudo','Carlos Mendes','Ativo']]} /><FormSection title="Cadastro / Edição"><Input placeholder="Título" /><Input placeholder="Slug" /><Input placeholder="Descrição curta" /><Textarea placeholder="Descrição longa" /><Select><option>Categoria</option></Select><Select><option>Apresentador</option></Select><Input placeholder="URL da capa" /><Input placeholder="Cor destaque" /><Select><option>Status</option></Select><Select><option>Instituição</option></Select><Input placeholder="Tags" /></FormSection></div>;
}
