import { useState } from 'react';
import type { Institution } from '@/types';

export function useInstitution() {
  const [institution, setInstitution] = useState<Institution>('Irmão Áureo');
  return { institution, setInstitution };
}
