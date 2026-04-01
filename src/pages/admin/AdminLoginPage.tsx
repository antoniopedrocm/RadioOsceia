import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export function AdminLoginPage() {
  const [email, setEmail] = useState('admin@irmaoaureo.dev');
  const [password, setPassword] = useState('');
  const [localUsername, setLocalUsername] = useState('Administrador');
  const [localPassword, setLocalPassword] = useState('');
  const [keepConnected, setKeepConnected] = useState(true);
  const { login, loginWithGoogle, loginLocalBreakGlass, isLocalBreakGlassEnabled, authIssue, clearAuthIssue } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    clearAuthIssue();
    setLoadingEmail(true);
    try {
      await login(email, password, keepConnected);
      navigate('/admin/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleLocalLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    clearAuthIssue();
    setLoadingLocal(true);
    try {
      await loginLocalBreakGlass(localUsername, localPassword);
      navigate('/admin/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login de contingência');
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    clearAuthIssue();
    setLoadingGoogle(true);

    try {
      await loginWithGoogle(keepConnected);
      navigate('/admin/dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Falha no login com Google');
    } finally {
      setLoadingGoogle(false);
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
            {authIssue ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Orientação para acesso administrativo</p>
                <p>{authIssue.message}</p>
              </div>
            ) : null}
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" type="submit" disabled={loadingEmail}>
              <Lock size={16} />
              {loadingEmail ? 'Entrando...' : 'Entrar no painel'}
            </Button>
            <Button
              className="w-full gap-2 border bg-white text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
            >
              <img src="/google-icon.svg" alt="" className="h-4 w-4" />
              {loadingGoogle ? 'Entrando...' : 'Entrar com Google'}
            </Button>
          </form>
          {isLocalBreakGlassEnabled ? (
            <form className="mt-6 space-y-3 border-t pt-4" onSubmit={handleLocalLogin}>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Acesso de contingência</p>
              <div className="space-y-2">
                <Label htmlFor="local-username">Usuário local</Label>
                <Input id="local-username" value={localUsername} onChange={(event) => setLocalUsername(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-password">Senha local</Label>
                <Input id="local-password" type="password" value={localPassword} onChange={(event) => setLocalPassword(event.target.value)} />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={loadingLocal}>
                {loadingLocal ? 'Validando...' : 'Entrar como Administrador local'}
              </Button>
            </form>
          ) : null}
          {import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && (
            <p className="mt-4 text-center text-xs text-slate-500">
              Use as contas seed do Firebase Emulator (admin@irmaoaureo.dev / operador@irmaoaureo.dev).
            </p>
          )}
          <Link to="/" className="mt-4 block text-center text-sm font-medium text-blue-600 hover:underline">
            Voltar ao site público
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
