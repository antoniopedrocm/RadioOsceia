import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Radio } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, keepConnected);
      navigate('/admin/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-100 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_55%)]" />
      <Card className="relative w-full max-w-md border-slate-200 shadow-xl shadow-slate-300/40">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-blue-700">
            <Radio />
          </div>
          <div>
            <CardTitle className="text-2xl text-slate-900">Acesso Restrito</CardTitle>
            <p className="text-sm text-slate-500">Plataforma de Gestão de Conteúdo</p>
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={keepConnected}
                onChange={(event) => setKeepConnected(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Manter conectado
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
              <Lock size={16} />
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Acesso exclusivo para administradores autorizados.</p>
          <Link to="/" className="mt-4 block text-center text-sm font-medium text-blue-600 hover:underline">
            Voltar ao site público
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
