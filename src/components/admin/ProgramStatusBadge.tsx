import { Badge } from '@/components/ui/badge';
import type { ProgramStatus } from '@/types/program';

interface ProgramStatusBadgeProps {
  status: ProgramStatus;
}

const STATUS_LABELS: Record<ProgramStatus, string> = {
  ACTIVE: 'Ativo',
  DRAFT: 'Rascunho',
  INACTIVE: 'Inativo'
};

const STATUS_CLASSNAMES: Record<ProgramStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  DRAFT: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  INACTIVE: 'bg-slate-200 text-slate-600 hover:bg-slate-200'
};

export function ProgramStatusBadge({ status }: ProgramStatusBadgeProps) {
  return <Badge className={STATUS_CLASSNAMES[status]}>{STATUS_LABELS[status]}</Badge>;
}
