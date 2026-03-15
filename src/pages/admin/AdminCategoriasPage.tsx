import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';

export function AdminCategoriasPage() {
  return <div><PageHeader title="Gestão de Categorias" description="Categorias com cor e descrição." action="Nova categoria" /><DataTable headers={['Nome','Cor','Descrição','Qtd Programas']} rows={[['Reflexão','#1E4FAE','Mensagens semanais',8],['Estudo','#0F766E','Estudos doutrinários',7],['Oração','#D8B45C','Momentos de oração',5]]} /></div>;
}
