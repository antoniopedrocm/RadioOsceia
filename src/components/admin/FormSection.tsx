import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{children}</CardContent></Card>;
}
