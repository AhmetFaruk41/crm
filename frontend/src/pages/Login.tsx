import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(username, password);
      nav('/', { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Giriş başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-xl sm:text-2xl font-bold tracking-wide text-ink-900">Can Bozyiğit</div>
          <div className="text-xs text-ink-500 mt-1">CRM Panel · Giriş</div>
        </div>
        <div className="card">
          <form onSubmit={submit} className="card-body space-y-4">
            <div>
              <label className="label">Kullanıcı Adı</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="kullanıcı adı"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Şifre</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="şifre"
                  required
                  minLength={1}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900 p-1"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
