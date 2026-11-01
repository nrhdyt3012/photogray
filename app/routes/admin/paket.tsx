import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, Modal, Notice, PageHeader, Select, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Package } from "~/lib/supabase/types";
import { formatRupiah } from "~/lib/format";

const BLANK: Partial<Package> = {
  name: "", price: 20000, photos_taken: 10, photos_selected: 3, print_layout: "half", is_active: true, sort_order: 0,
};

export default function Paket() {
  const [items, setItems] = useState<Package[]>([]);
  const [editing, setEditing] = useState<Partial<Package> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("packages").select("*").order("sort_order").order("price");
    setItems((data ?? []) as Package[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const row = {
      name: editing.name?.trim(),
      price: Number(editing.price),
      photos_taken: Number(editing.photos_taken),
      photos_selected: Number(editing.photos_selected),
      print_layout: editing.print_layout,
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    const sb = getSupabase();
    const { error } = editing.id
      ? await sb.from("packages").update(row).eq("id", editing.id)
      : await sb.from("packages").insert(row);
    if (error) { setError(error.message); return; }
    setEditing(null);
    setError(null);
    load();
  };

  const remove = async (p: Package) => {
    if (!confirm(`Hapus ${p.name}? Riwayat transaksi lama tetap aman.`)) return;
    const { error } = await getSupabase().from("packages").delete().eq("id", p.id);
    setError(error?.message ?? null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Paket"
        hint="Berlaku untuk semua cabang. Mengubah harga tidak mengubah laporan transaksi yang sudah ada."
        action={<Btn onClick={() => setEditing({ ...BLANK })}>Tambah paket</Btn>}
      />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {items.length === 0 ? (
        <Empty>Belum ada paket.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-3xl font-semibold">{formatRupiah(p.price)}</p>
                  <p className="text-sm text-slate-600">{p.name}</p>
                </div>
                <span className={p.is_active ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-slate-500"}>
                  {p.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="text-sm">
                Ambil {p.photos_taken} foto, pilih {p.photos_selected} · cetak 4R {p.print_layout === "half" ? "dibagi 2" : "penuh"}
              </p>
              <div className="flex gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setEditing(p)}>Ubah</Btn>
                <Btn variant="danger" onClick={() => remove(p)}>Hapus</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Ubah paket" : "Tambah paket"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nama paket">
              <TextInput required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga (Rp)">
                <TextInput type="number" min={0} step={1000} required value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </Field>
              <Field label="Urutan tampil">
                <TextInput type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </Field>
              <Field label="Jumlah foto diambil">
                <TextInput type="number" min={1} max={40} required value={editing.photos_taken ?? 10} onChange={(e) => setEditing({ ...editing, photos_taken: Number(e.target.value) })} />
              </Field>
              <Field label="Foto dipilih untuk frame" hint="Harus sama dengan jumlah kotak foto di frame">
                <TextInput type="number" min={1} max={12} required value={editing.photos_selected ?? 3} onChange={(e) => setEditing({ ...editing, photos_selected: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Ukuran cetak">
              <Select value={editing.print_layout} onChange={(e) => setEditing({ ...editing, print_layout: e.target.value as "half" | "full" })}>
                <option value="half">4R dibagi 2 (dua strip per lembar)</option>
                <option value="full">4R penuh (satu desain per lembar)</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Aktif (bisa dipilih kasir)
            </label>
            <Btn type="submit" className="w-full">Simpan</Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
