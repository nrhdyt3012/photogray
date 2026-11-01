import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAdmin } from "~/components/admin/context";
import { Btn, Card, Empty, Field, Modal, Notice, PageHeader, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Room } from "~/lib/supabase/types";

export default function Ruangan() {
  const { branchId, branches } = useAdmin();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("rooms").select("*").eq("branch_id", branchId).order("name");
    setRooms((data ?? []) as Room[]);
  }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    const sb = getSupabase();
    const { error } = editing.id
      ? await sb.from("rooms").update({ name: editing.name.trim(), is_active: editing.is_active ?? true }).eq("id", editing.id)
      : await sb.from("rooms").insert({ branch_id: branchId, name: editing.name.trim() });
    if (error) {
      setError(error.code === "23505" ? "Nama ruangan sudah dipakai di cabang ini" : error.message);
      return;
    }
    setEditing(null);
    setError(null);
    load();
  };

  const remove = async (r: Room) => {
    if (!confirm(`Hapus ${r.name}?`)) return;
    const { error } = await getSupabase().from("rooms").delete().eq("id", r.id);
    setError(error ? "Ruangan sudah punya riwayat transaksi, jadi tidak bisa dihapus. Nonaktifkan saja." : null);
    load();
  };

  const kioskUrl = (r: Room) => `${window.location.origin}/booth/${r.kiosk_code}`;
  const copy = async (r: Room) => {
    await navigator.clipboard.writeText(kioskUrl(r));
    setCopied(r.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <PageHeader
        title="Ruangan"
        hint={`Cabang ${branches.find((b) => b.id === branchId)?.name ?? ""}. Tiap ruangan punya alamat layar booth sendiri.`}
        action={<Btn onClick={() => setEditing({ name: "", is_active: true })}>Tambah ruangan</Btn>}
      />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {rooms.length === 0 ? (
        <Empty>Belum ada ruangan di cabang ini.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rooms.map((r) => (
            <Card key={r.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-xl font-semibold">{r.name}</p>
                <span className={r.is_active ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-slate-500"}>
                  {r.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Alamat layar booth (buka di komputer ruangan ini)</p>
                <code className="block break-all rounded-lg bg-slate-100 p-2 text-xs">{kioskUrl(r)}</code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={() => copy(r)}>{copied === r.id ? "Tersalin" : "Salin alamat"}</Btn>
                <Btn variant="ghost" onClick={() => setEditing(r)}>Ubah</Btn>
                <Btn variant="danger" onClick={() => remove(r)}>Hapus</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Ubah ruangan" : "Tambah ruangan"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nama ruangan">
              <TextInput required autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ruang 1" />
            </Field>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Aktif (bisa dipilih kasir)
              </label>
            )}
            <Btn type="submit" className="w-full">Simpan</Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
