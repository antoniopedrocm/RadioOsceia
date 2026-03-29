export type Institution = 'Irmão Áureo';

export interface Program {
  id: string;
  titulo: string;
  categoria: string;
  apresentador: string;
  duracao: string;
  origem: 'YouTube' | 'Vídeo local' | 'Áudio local' | 'Vinheta';
  instituicao: Institution;
  descricao: string;
  capa: string;
}

export interface Presenter {
  id: string;
  nome: string;
  bio: string;
  foto: string;
  programas: string[];
}

export interface QueueItem {
  id: string;
  titulo: string;
  programa: string;
  tipo: Program['origem'];
  inicio: string;
  status: 'No ar' | 'Agendado';
}
