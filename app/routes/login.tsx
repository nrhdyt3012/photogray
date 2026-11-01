import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useAuth } from "~/lib/auth";
import { Btn, Field, Notice, TextInput } from "~/components/admin/ui";
import { isSupabaseConfigured } from "~/lib/supabase/client";

export function meta() {
  return [{ title: "Masuk | Snap & Go" }];
}

export default function Login() {
  const { session, profile, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session && profile) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email.trim(), password));
    setBusy(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Masuk</h1>
          <p className="text-sm text-slate-600">Panel kasir &amp; owner Snap &amp; Go</p>
        </div>
        {!isSupabaseConfigured() && (
          <Notice kind="error">VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi di .env</Notice>
        )}
        <Field label="Email">
          <TextInput type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Kata sandi">
          <TextInput type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        {session && !profile && !loading && (
          <Notice kind="error">Akun ini belum punya peran atau sudah dinonaktifkan. Hubungi owner.</Notice>
        )}
        <Btn type="submit" disabled={busy} className="w-full">
          {busy ? "Memeriksa..." : "Masuk"}
        </Btn>
      </form>
    </main>
  );
}
