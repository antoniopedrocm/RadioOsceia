import type { Institution } from '@/types';

const INSTITUTION: Institution = 'Irmão Áureo';

export function useInstitution() {
  return { institution: INSTITUTION };
}
