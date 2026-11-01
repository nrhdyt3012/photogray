import { useState, type FormEvent } from "react";
import { useAdmin } from "~/components/admin/context";
import { Btn, Card, Empty, Field, Modal, Notice, PageHeader, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Branch } from "~/lib/supabase/types";

export default function Cabang() {
  const { branches, reloadBranches } = useAdmin();
  const [editing, setEditing] = useState<Partial<Branch> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    const row = {
      name: editing.name.trim(),
      city: editing.city?.trim() || "Surabaya",
      address: editing.address?.trim() || null,
      is_active: editing.is_active ?? true,
    };
    const sb = getSupabase();
    const { error } = editing.id
      ? await sb.from("branches").update(row).eq("id", editing.id)
      : await sb.from("branches").insert(row);
    if (error) { setError(error.message); return; }
    setEditing(null);
    setError(null);
    await reloadBranches();
  };

  return (
    <>
      <PageHeader
        title="Cabang"
        hint="Tambah titik baru di Surabaya, Sidoarjo, Gresik, atau kota lain."
        action={<Btn onClick={() => setEditing({ name: "", city: "Surabaya", is_active: true })}>Tambah cabang</Btn>}
      />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {branches.length === 0 ? (
        <Empty>Belum ada cabang.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <Card key={b.id} className="space-y-1">
              <p className="font-display text-xl font-semibold">{b.name}</p>
              <p className="text-sm text-slate-600">{b.city}{b.address ? ` · ${b.address}` : ""}</p>
              <p className={b.is_active ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-slate-500"}>
                {b.is_active ? "Aktif" : "Nonaktif"}
              </p>
              <div className="pt-2"><Btn variant="ghost" onClick={() => setEditing(b)}>Ubah</Btn></div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? "Ubah cabang" : "Tambah cabang"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nama cabang"><TextInput required autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Royal Plaza" /></Field>
            <Field label="Kota"><TextInput value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
            <Field label="Alamat (opsional)"><TextInput value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Aktif
              </label>
            )}
            <Btn type="submit" className="w-full">Simpan</Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
