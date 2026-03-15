import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ComoOuvirPage() {
  const steps = ['Acesse pelo navegador em desktop ou celular.', 'Use o player fixo para ouvir rádio e assistir web TV.', 'Consulte a programação e ative lembretes (futuro).'];
  return <div><h1 className="mb-4 text-2xl font-semibold">Como ouvir / assistir</h1><div className="grid gap-4 md:grid-cols-3">{steps.map((s, i) => <Card key={i}><CardHeader><CardTitle>Passo {i + 1}</CardTitle></CardHeader><CardContent>{s}</CardContent></Card>)}</div></div>;
}
