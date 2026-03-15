import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Program } from '@/types';

export function ProgramCard({ program }: { program: Program }) {
  return (
    <motion.article whileHover={{ y: -3 }} className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <img src={program.capa} alt={program.titulo} className="h-40 w-full object-cover" />
      <div className="space-y-2 p-4">
        <h3 className="font-semibold">{program.titulo}</h3>
        <p className="text-sm text-muted-foreground">{program.apresentador}</p>
        <div className="flex flex-wrap gap-2"><Badge>{program.categoria}</Badge><Badge className="bg-muted">{program.origem}</Badge></div>
        <Button size="sm" variant="outline">Ver detalhes</Button>
      </div>
    </motion.article>
  );
}
