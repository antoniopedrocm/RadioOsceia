import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Presenter = {
  name: string;
  bio: string;
  image: string;
  programs: string;
};

const initialPresenters: Presenter[] = [
  {
    name: 'Ana Clara',
    bio: 'Locutora e mediadora de conteúdo espiritual com foco em bem-estar diário.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    programs: 'Mensagem de Luz, Café com Esperança'
  },
  {
    name: 'Rafael Dias',
    bio: 'Jornalista e apresentador de entrevistas com convidados especiais.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    programs: 'Jornal da Esperança'
  }
];

export function AdminApresentadoresPage() {
  const [presenters, setPresenters] = useState(initialPresenters);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [programs, setPrograms] = useState('');
  const [photoMode, setPhotoMode] = useState<'url' | 'upload'>('url');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);

  const previewImage = useMemo(() => {
    if (photoMode === 'upload' && uploadedPhoto) {
      return URL.createObjectURL(uploadedPhoto);
    }
    return photoUrl;
  }, [photoMode, photoUrl, uploadedPhoto]);

  const closeModal = () => {
    setEditingIndex(null);
    setName('');
    setBio('');
    setPrograms('');
    setPhotoMode('url');
    setPhotoUrl('');
    setUploadedPhoto(null);
  };

  const openEdit = (index: number) => {
    const presenter = presenters[index];
    setEditingIndex(index);
    setName(presenter.name);
    setBio(presenter.bio);
    setPrograms(presenter.programs);
    setPhotoMode('url');
    setPhotoUrl(presenter.image);
    setUploadedPhoto(null);
  };

  const handleSave = () => {
    if (editingIndex === null) return;
    const nextImage = photoMode === 'upload' ? previewImage || presenters[editingIndex].image : photoUrl;

    const next = [...presenters];
    next[editingIndex] = {
      ...next[editingIndex],
      name,
      bio,
      programs,
      image: nextImage
    };
    setPresenters(next);
    closeModal();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Apresentadores" description="Gerencie equipe, bios e vínculo com programas." action="Novo apresentador" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {presenters.map((presenter, index) => (
          <Card key={presenter.name}>
            <CardContent className="space-y-3 p-4">
              <img src={presenter.image} alt={presenter.name} className="h-20 w-20 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold">{presenter.name}</h3>
                <p className="text-sm text-muted-foreground">{presenter.bio}</p>
              </div>
              <p className="text-xs text-muted-foreground">Programas: {presenter.programs}</p>
              <Button variant="outline" onClick={() => openEdit(index)}>Editar</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-xl font-semibold">Editar apresentador</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="presenter-name">Nome</Label>
                  <Input id="presenter-name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="presenter-programs">Programas vinculados</Label>
                  <Input id="presenter-programs" value={programs} onChange={(event) => setPrograms(event.target.value)} />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <Label>Foto</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={photoMode === 'url' ? 'default' : 'outline'} onClick={() => setPhotoMode('url')}>URL</Button>
                  <Button type="button" variant={photoMode === 'upload' ? 'default' : 'outline'} onClick={() => setPhotoMode('upload')}>Upload</Button>
                </div>

                {photoMode === 'url' ? (
                  <div className="space-y-2">
                    <Label htmlFor="presenter-photo-url">URL da foto</Label>
                    <Input
                      id="presenter-photo-url"
                      placeholder="https://..."
                      value={photoUrl}
                      onChange={(event) => setPhotoUrl(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="presenter-photo-upload">Upload da foto</Label>
                    <Input
                      id="presenter-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setUploadedPhoto(event.target.files?.[0] ?? null)}
                    />
                  </div>
                )}

                {previewImage ? <img src={previewImage} alt="Pré-visualização da foto" className="h-24 w-24 rounded-full object-cover" /> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="presenter-bio">Bio curta</Label>
                <Textarea id="presenter-bio" value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button type="button" onClick={handleSave}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
