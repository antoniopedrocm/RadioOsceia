import { DataTable } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';

export function AdminMidiasPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Mídias" description="Liste e cadastre mídias da rádio." action="Nova Mídia" />
      <DataTable
        headers={['Título', 'Tipo', 'Origem', 'Duração', 'Programa vinculado', 'Status']}
        rows={[
          ['Abertura Oficial', 'Introdução', 'Áudio local', '00:35', 'Mensagem de Luz', 'Ativo'],
          ['Entrevista Especial', 'Vídeo YouTube', 'YouTube', '18:20', 'Jornal da Esperança', 'Ativo'],
          ['Vinheta Fé e Música', 'Vinheta', 'Áudio local', '00:15', 'Momento Musical', 'Ativo'],
          ['Encerramento da Manhã', 'Encerramento', 'Vídeo local', '00:40', 'Mensagem de Luz', 'Rascunho']
        ]}
      />
    </div>
  );
}
