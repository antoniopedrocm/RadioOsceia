import type { Presenter, Program, QueueItem } from '@/types';

export const institutions = [
  { nome: 'Irmão Áureo', primaria: '#1E4FAE', secundaria: '#D8B45C' },
  { nome: 'OSCEIA', primaria: '#0F766E', secundaria: '#D4A017' }
];

export const programs: Program[] = [
  { id: '1', titulo: 'Mensagem de Luz', categoria: 'Reflexão', apresentador: 'Ana Clara', duracao: '30 min', origem: 'YouTube', instituicao: 'Irmão Áureo', descricao: 'Reflexões semanais e palavras de acolhimento.', capa: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=400' },
  { id: '2', titulo: 'Estudo do Evangelho', categoria: 'Estudo', apresentador: 'Carlos Mendes', duracao: '60 min', origem: 'Vídeo local', instituicao: 'OSCEIA', descricao: 'Estudo estruturado com participação da comunidade.', capa: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=400' },
  { id: '3', titulo: 'Momento de Oração', categoria: 'Oração', apresentador: 'Marta Silva', duracao: '20 min', origem: 'Áudio local', instituicao: 'Irmão Áureo', descricao: 'Pausa diária para oração e serenidade.', capa: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=400' }
];

export const presenters: Presenter[] = [
  { id: '1', nome: 'Ana Clara', bio: 'Comunicadora e facilitadora de estudos.', foto: 'https://i.pravatar.cc/300?img=5', programas: ['Mensagem de Luz'] },
  { id: '2', nome: 'Carlos Mendes', bio: 'Palestrante voluntário e pesquisador.', foto: 'https://i.pravatar.cc/300?img=15', programas: ['Estudo do Evangelho'] },
  { id: '3', nome: 'Marta Silva', bio: 'Condutora de momentos de oração.', foto: 'https://i.pravatar.cc/300?img=25', programas: ['Momento de Oração'] }
];

export const queue: QueueItem[] = [
  { id: 'q1', titulo: 'Mensagem de Luz #128', programa: 'Mensagem de Luz', tipo: 'YouTube', inicio: '14:00', status: 'No ar' },
  { id: 'q2', titulo: 'Vinheta Institucional', programa: 'Vinhetas', tipo: 'Vinheta', inicio: '14:30', status: 'Agendado' },
  { id: 'q3', titulo: 'Estudo do Evangelho #54', programa: 'Estudo do Evangelho', tipo: 'Vídeo local', inicio: '15:00', status: 'Agendado' }
];

export const logs = [
  ['15/03 10:12', 'Operador Lucas', 'Publicou', 'Programação', 'Ajuste de grade da tarde', 'Sucesso'],
  ['15/03 09:45', 'Editor Paula', 'Editou', 'Programa', 'Atualizou descrição', 'Sucesso'],
  ['15/03 08:10', 'Admin Joana', 'Criou', 'Mídia', 'Nova vinheta institucional', 'Sucesso']
];
