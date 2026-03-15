import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export function AdminLoginPage() {
  const [email, setEmail] = useState('admin@radioosceia.dev');
  const [password, setPassword] = useState('');
  const [keepConnected, setKeepConnected] = useState(true);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login(email);
    if (!keepConnected) {
      sessionStorage.setItem('admin_session_temporary', 'true');
    }
    navigate('/admin/dashboard');
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-md border-0 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Radio />
          </div>
          <div>
            <CardTitle className="text-2xl">Painel Administrativo</CardTitle>
            <p className="text-sm text-muted-foreground">Rádio OSCEIA • Gestão institucional</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={keepConnected}
                onChange={(event) => setKeepConnected(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Manter conectado
            </label>
            <Button className="w-full" type="submit">
              Entrar no painel
            </Button>
          </form>
          <Link to="/" className="mt-4 block text-center text-sm text-primary hover:underline">
            Voltar ao site público
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
