import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AdminLoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md"><CardHeader><CardTitle>Acesso administrativo</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" placeholder="admin@instituicao.org.br" /></div><div><Label htmlFor="senha">Senha</Label><Input id="senha" type="password" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" /> Lembrar acesso</label><Button className="w-full">Entrar</Button><p className="text-xs text-muted-foreground">Ambiente protegido para gestão institucional (mock).</p></CardContent></Card>
    </div>
  );
}
