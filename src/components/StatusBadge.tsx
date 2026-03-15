import { Badge } from '@/components/ui/badge';
export function StatusBadge({ status }: { status: string }) { return <Badge className={status === 'Ativo' ? 'bg-success text-white' : 'bg-warning text-white'}>{status}</Badge>; }
