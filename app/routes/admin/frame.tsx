import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, Modal, Notice, PageHeader, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { FrameRow } from "~/lib/supabase/types";
import { detectSlots } from "~/lib/detect-slots";

type Draft = Partial<FrameRow> & { file?: File };
type Slot = FrameRow["photo_slots"][number];

export default function Frame() {
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("frames").select("*").order("sort_order").order("name");
    setFrames((data ?? []) as FrameRow[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draft?.file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(draft.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft?.file]);

  const pickFile = async (file: File | undefined) => {
    if (!file || !draft) return;
    setError(null);
    setInfo(null);
    if (file.type !== "image/png") { setError("Frame harus berupa PNG dengan kotak foto transparan"); return; }
    try {
      const { width, height, slots } = await detectSlots(file);
      setDraft({
        ...draft, file, width, height,
        orientation: width > height ? "horizontal" : "vertical",
        photo_slots: slots,
      });
      setInfo(
        slots.length
          ? `${slots.length} kotak foto terdeteksi. Periksa angkanya, koreksi jika perlu.`
          : "Kotak foto transparan tidak terdeteksi. Isi koordinatnya manual."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca gambar");
    }
  };

  const updateSlot = (i: number, key: keyof Slot, value: number) => {
    if (!draft) return;
    const slots = [...(draft.photo_slots ?? [])];
    slots[i] = { ...slots[i], [key]: value };
    setDraft({ ...draft, photo_slots: slots });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !draft.file) { setError("Pilih file gambar frame"); return; }
    if (!draft.photo_slots?.length) { setError("Frame butuh minimal satu kotak foto"); return; }
    setBusy(true);
    setError(null);
    const sb = getSupabase();
    let image_url = draft.image_url;
    if (draft.file) {
      const path = `${crypto.randomUUID()}.png`;
      const up = await sb.storage.from("frames").upload(path, draft.file, { contentType: "image/png" });
      if (up.error) { setBusy(false); setError(up.error.message); return; }
      image_url = sb.storage.from("frames").getPublicUrl(path).data.publicUrl;
    }
    if (draft.is_default) await sb.from("frames").update({ is_default: false }).neq("id", draft.id ?? "00000000-0000-0000-0000-000000000000");
    const row = {
      name: draft.name?.trim(),
      orientation: draft.orientation,
      image_url,
      width: draft.width,
      height: draft.height,
      photo_slots: draft.photo_slots,
      is_default: draft.is_default ?? false,
      is_active: draft.is_active ?? true,
      sort_order: Number(draft.sort_order ?? 0),
    };
    const { error: err } = draft.id
      ? await sb.from("frames").update(row).eq("id", draft.id)
      : await sb.from("frames").insert(row);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDraft(null);
    load();
  };

  const remove = async (f: FrameRow) => {
    if (!confirm(`Hapus frame ${f.name}?`)) return;
    const { error } = await getSupabase().from("frames").delete().eq("id", f.id);
    setError(error?.message ?? null);
    load();
  };

  const shownImage = previewUrl ?? draft?.image_url ?? null;

  return (
    <>
      <PageHeader
        title="Frame"
        hint="Frame dipakai semua cabang. Unggah PNG dengan kotak foto transparan; kotak foto dideteksi otomatis."
        action={<Btn onClick={() => { setDraft({ name: "", is_active: true, is_default: false, sort_order: frames.length + 1, photo_slots: [] }); setInfo(null); setError(null); }}>Tambah frame</Btn>}
      />
      {error && !draft && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      {frames.length === 0 ? (
        <Empty>Belum ada frame.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {frames.map((f) => (
            <Card key={f.id} className="space-y-3">
              <div className="grid h-44 place-items-center rounded-lg bg-slate-100 p-2">
                <img src={f.image_url} alt={f.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <p className="font-semibold">{f.name}{f.is_default && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs">Utama</span>}</p>
                <p className="text-xs text-slate-500">
                  {f.orientation === "vertical" ? "Vertikal" : "Horizontal"} · {f.photo_slots.length} kotak foto · {f.is_active ? "Aktif" : "Nonaktif"}
                </p>
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" className="px-3 py-1 text-xs" onClick={() => { setDraft(f); setInfo(null); setError(null); }}>Ubah</Btn>
                <Btn variant="danger" className="px-3 py-1 text-xs" onClick={() => remove(f)}>Hapus</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <Modal title={draft.id ? "Ubah frame" : "Tambah frame"} onClose={() => setDraft(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nama frame"><TextInput required value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label={draft.id ? "Ganti gambar (opsional)" : "Gambar frame (PNG)"}>
              <input type="file" accept="image/png" onChange={(e) => pickFile(e.target.files?.[0])} className="block w-full text-sm" />
            </Field>

            {shownImage && draft.width && draft.height && (
              <div className="rounded-lg bg-slate-100 p-3">
                <svg viewBox={`0 0 ${draft.width} ${draft.height}`} className="mx-auto max-h-72 w-auto" role="img" aria-label="Pratinjau frame dengan kotak foto">
                  <rect width={draft.width} height={draft.height} fill="#cbd5e1" />
                  <image href={shownImage} width={draft.width} height={draft.height} />
                  {(draft.photo_slots ?? []).map((s, i) => (
                    <g key={i}>
                      <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="rgba(251,191,36,.25)" stroke="#d97706" strokeWidth={Math.max(2, draft.width! / 200)} />
                      <text x={s.x + s.width / 2} y={s.y + s.height / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(s.width, s.height) / 3} fill="#78350f" fontWeight="700">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              </div>
            )}

            {(draft.photo_slots ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Kotak foto ({draft.photo_slots!.length}) · ukuran gambar {draft.width}×{draft.height}</p>
                {draft.photo_slots!.map((s, i) => (
                  <div key={i} className="grid grid-cols-5 items-center gap-2 text-xs">
                    <span className="font-semibold">#{i + 1}</span>
                    {(["x", "y", "width", "height"] as const).map((k) => (
                      <TextInput key={k} type="number" aria-label={`${k} kotak ${i + 1}`} value={s[k]} onChange={(e) => updateSlot(i, k, Number(e.target.value))} className="px-2 py-1" />
                    ))}
                  </div>
                ))}
                <p className="text-xs text-slate-500">Urutan kolom: x, y, lebar, tinggi. Nomor kotak = urutan foto yang ditempel.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active ?? true} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />Aktif</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_default ?? false} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />Frame utama</label>
            </div>
            {info && <Notice kind="ok">{info}</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
            <Btn type="submit" disabled={busy} className="w-full">{busy ? "Menyimpan..." : "Simpan"}</Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
