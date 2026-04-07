export type ProgramStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE';

export interface AdminProgramRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  coverUrl?: string;
  presenterId?: string | null;
  presenterName?: string | null;
  categoryName?: string | null;
  tags?: string[];
  status: ProgramStatus;
  isActive: boolean;
}

export interface ProgramFormValues {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  coverUrl: string;
  presenterId: string;
  categoryName: string;
  tags: string;
  status: ProgramStatus;
}

export interface ProgramPresenterOption {
  id: string;
  name: string;
}
