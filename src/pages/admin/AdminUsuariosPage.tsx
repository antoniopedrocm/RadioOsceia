import { PageHeader } from '@/components/admin/PageHeader';
import { DataTable } from '@/components/admin/DataTable';

export function AdminUsuariosPage() {
  return <div><PageHeader title="Usuários e Perfis" description="Gestão de acessos por instituição." action="Novo usuário" /><DataTable headers={['Nome','E-mail','Perfil','Status','Instituição']} rows={[['Joana Lima','joana@org.br','Administrador','Ativo','Irmão Áureo'],['Paula Reis','paula@org.br','Editor','Ativo','OSCEIA'],['Lucas Neri','lucas@org.br','Operador','Ativo','Irmão Áureo']]} /></div>;
}
