import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "~/components/admin/context";
import { Btn, Card, Empty, Field, Modal, Notice, PageHeader, Select, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Profile, UserRole } from "~/lib/supabase/types";

async function callApi(body: Record<string, unknown>): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch("/api/staff", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? null : json.error ?? "Permintaan gagal";
}

export default function Staf() {
  const { branches, profile: me } = useAdmin();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [creating, setCreating] = useState<{ email: string; password: string; full_name: string; role: UserRole; branch_id: string } | null>(null);
  const [pwFor, setPwFor] = useState<Profile | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("profiles").select("*").order("full_name");
    setStaff((data ?? []) as Profile[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "Semua cabang";

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!creating) return;
    const err = await callApi({ action: "create", ...creating, email: creating.email.trim() });
    if (err) { setError(err); return; }
    setCreating(null);
    setError(null);
    setOk("Akun dibuat. Berikan email dan kata sandi ke petugas.");
    load();
  };

  const toggle = async (p: Profile) => {
    if (p.id === me.id) return;
    const { error } = await getSupabase().from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    setError(error?.message ?? null);
    load();
  };

  const changeBranch = async (p: Profile, branch_id: string) => {
    const { error } = await getSupabase().from("profiles").update({ branch_id }).eq("id", p.id);
    setError(error?.message ?? null);
    load();
  };

  const setPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwFor) return;
    const err = await callApi({ action: "set_password", user_id: pwFor.id, password: pw });
    if (err) { setError(err); return; }
    setPwFor(null);
    setPw("");
    setError(null);
    setOk("Kata sandi diganti.");
  };

  return (
    <>
      <PageHeader
        title="Akun staf"
        hint="Kasir hanya bisa mengakses cabangnya sendiri. Akun nonaktif langsung tidak bisa masuk."
        action={<Btn onClick={() => setCreating({ email: "", password: "", full_name: "", role: "cashier", branch_id: branches[0]?.id ?? "" })}>Tambah akun</Btn>}
      />
      <div className="mb-4 space-y-2">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="ok">{ok}</Notice>}
      </div>

      {staff.length === 0 ? (
        <Empty>Belum ada akun.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="p-3 font-medium">Nama</th>
                <th className="p-3 font-medium">Peran</th>
                <th className="p-3 font-medium">Cabang</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{p.full_name}{p.id === me.id && <span className="ml-2 text-xs text-slate-500">(Anda)</span>}</td>
                  <td className="p-3">{p.role === "owner" ? "Owner" : "Kasir"}</td>
                  <td className="p-3">
                    {p.role === "owner" ? (
                      "Semua cabang"
                    ) : (
                      <Select aria-label={`Cabang ${p.full_name}`} value={p.branch_id ?? ""} onChange={(e) => changeBranch(p, e.target.value)} className="w-44 py-1">
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </Select>
                    )}
                    {p.role === "owner" ? null : <span className="sr-only">{branchName(p.branch_id)}</span>}
                  </td>
                  <td className="p-3">{p.is_active ? "Aktif" : "Nonaktif"}</td>
                  <td className="space-x-2 p-3 text-right">
                    <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setPwFor(p)}>Ganti sandi</Btn>
                    {p.id !== me.id && (
                      <Btn variant={p.is_active ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={() => toggle(p)}>
                        {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {creating && (
        <Modal title="Tambah akun" onClose={() => setCreating(null)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Nama lengkap"><TextInput required value={creating.full_name} onChange={(e) => setCreating({ ...creating, full_name: e.target.value })} /></Field>
            <Field label="Email"><TextInput type="email" required value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} /></Field>
            <Field label="Kata sandi awal" hint="Minimal 8 karakter"><TextInput type="text" minLength={8} required value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} /></Field>
            <Field label="Peran">
              <Select value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value as UserRole })}>
                <option value="cashier">Kasir / petugas</option>
                <option value="owner">Owner</option>
              </Select>
            </Field>
            {creating.role === "cashier" && (
              <Field label="Cabang">
                <Select required value={creating.branch_id} onChange={(e) => setCreating({ ...creating, branch_id: e.target.value })}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            )}
            <Btn type="submit" className="w-full">Buat akun</Btn>
          </form>
        </Modal>
      )}

      {pwFor && (
        <Modal title={`Ganti sandi ${pwFor.full_name}`} onClose={() => setPwFor(null)}>
          <form onSubmit={setPassword} className="space-y-4">
            <Field label="Kata sandi baru" hint="Minimal 8 karakter"><TextInput type="text" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Btn type="submit" className="w-full">Simpan</Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
