export type PresenterStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminPresenterRecord {
  id: string;
  name: string;
  shortBio: string;
  photoUrl: string;
  status: PresenterStatus;
  isActive: boolean;
  programTitles: string[];
}

export interface PresenterFormValues {
  name: string;
  shortBio: string;
  photoUrl: string;
  status: PresenterStatus;
}
