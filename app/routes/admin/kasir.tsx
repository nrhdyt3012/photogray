import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "~/components/admin/context";
import { Btn, Card, Empty, Notice, PageHeader, StatusBadge } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Package, PaymentMethod, Room, Transaction } from "~/lib/supabase/types";
import { dayRange, formatRupiah, formatTime, PAYMENT_LABEL, todayWib } from "~/lib/format";
import { cn } from "~/lib/utils";

export default function Kasir() {
  const { branchId } = useAdmin();
  const [packages, setPackages] = useState<Package[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [packageId, setPackageId] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { from, to } = dayRange(todayWib());
    const [p, r, t] = await Promise.all([
      sb.from("packages").select("*").eq("is_active", true).order("sort_order"),
      sb.from("rooms").select("*").eq("branch_id", branchId).eq("is_active", true).order("name"),
      sb
        .from("transactions")
        .select("*")
        .eq("branch_id", branchId)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at", { ascending: false }),
    ]);
    setPackages((p.data ?? []) as Package[]);
    setRooms((r.data ?? []) as Room[]);
    setTxns((t.data ?? []) as Transaction[]);
  }, [branchId]);

  useEffect(() => {
    setRoomId("");
    load();
    const timer = setInterval(load, 5000); // status ruangan berubah saat tamu mulai/selesai
    return () => clearInterval(timer);
  }, [load]);

  const openByRoom = useMemo(() => {
    const map = new Map<string, Transaction>();
    txns.forEach((t) => (t.status === "ready" || t.status === "in_progress") && map.set(t.room_id, t));
    return map;
  }, [txns]);

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "—";
  const canSave = !!packageId && !!payment && !!roomId && !busy;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await getSupabase()
      .from("transactions")
      .insert({ room_id: roomId, package_id: packageId, payment_method: payment });
    setBusy(false);
    if (error) {
      setMsg({
        kind: "error",
        text: error.code === "23505" ? "Ruangan ini masih punya transaksi yang belum selesai" : error.message,
      });
      return;
    }
    setMsg({ kind: "ok", text: `Tersimpan. Tombol Start di ${roomName(roomId)} sekarang menyala.` });
    setPackageId("");
    setPayment("");
    setRoomId("");
    load();
  };

  const setStatus = async (t: Transaction, status: "ready" | "cancelled") => {
    const patch = status === "ready" ? { status, started_at: null } : { status };
    await getSupabase()
      .from("transactions")
      .update(patch)
      .eq("id", t.id)
      .in("status", ["ready", "in_progress"]);
    load();
  };

  const total = txns.filter((t) => t.status !== "cancelled").reduce((s, t) => s + t.price, 0);

  return (
    <>
      <PageHeader title="Kasir" hint="Catat paket dan pembayaran, lalu pilih ruangan. Tombol Start di ruangan itu baru menyala setelah disimpan." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">1. Paket</legend>
            {packages.length === 0 ? (
              <Empty>Belum ada paket aktif. Tambahkan di menu Paket.</Empty>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {packages.map((p) => (
                  <ChoiceCard key={p.id} selected={packageId === p.id} onClick={() => setPackageId(p.id)}>
                    <span className="font-display text-2xl font-semibold">{formatRupiah(p.price)}</span>
                    <span className="text-sm">{p.photos_taken} foto · 4R {p.print_layout === "half" ? "dibagi 2" : "penuh"}</span>
                    <span className="text-xs text-slate-500">{p.name}</span>
                  </ChoiceCard>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">2. Metode pembayaran</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "qris"] as const).map((m) => (
                <ChoiceCard key={m} selected={payment === m} onClick={() => setPayment(m)}>
                  <span className="font-semibold">{PAYMENT_LABEL[m]}</span>
                </ChoiceCard>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">3. Ruangan</legend>
            {rooms.length === 0 ? (
              <Empty>Belum ada ruangan di cabang ini. Tambahkan di menu Ruangan.</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rooms.map((r) => {
                  const busyRoom = openByRoom.get(r.id);
                  return (
                    <ChoiceCard
                      key={r.id}
                      selected={roomId === r.id}
                      disabled={!!busyRoom}
                      onClick={() => setRoomId(r.id)}
                    >
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-xs">{busyRoom ? "Sedang dipakai" : "Kosong"}</span>
                    </ChoiceCard>
                  );
                })}
              </div>
            )}
          </fieldset>

          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <Btn onClick={save} disabled={!canSave} className="w-full py-3 text-base">
            {busy ? "Menyimpan..." : "Simpan & nyalakan ruangan"}
          </Btn>
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Transaksi hari ini</h2>
            <p className="text-sm text-slate-600">
              {txns.filter((t) => t.status !== "cancelled").length} transaksi · <b>{formatRupiah(total)}</b>
            </p>
          </div>
          {txns.length === 0 ? (
            <Empty>Belum ada transaksi hari ini.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {txns.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="w-12 text-sm tabular-nums text-slate-500">{formatTime(t.created_at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {roomName(t.room_id)} · {formatRupiah(t.price)} · {PAYMENT_LABEL[t.payment_method]}
                    </p>
                    <p className="truncate text-xs text-slate-500">{t.package_name}</p>
                  </div>
                  <StatusBadge status={t.status} />
                  {t.status === "in_progress" && (
                    <Btn variant="ghost" className="px-2 py-1 text-xs" onClick={() => setStatus(t, "ready")}>
                      Buka ulang
                    </Btn>
                  )}
                  {(t.status === "ready" || t.status === "in_progress") && (
                    <Btn
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      onClick={() => confirm("Batalkan transaksi ini?") && setStatus(t, "cancelled")}
                    >
                      Batalkan
                    </Btn>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function ChoiceCard({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition",
        selected ? "border-slate-900 bg-amber-100" : "border-slate-200 bg-white hover:border-slate-400",
        disabled && "cursor-not-allowed bg-slate-100 text-slate-400 hover:border-slate-200",
      )}
    >
      {children}
    </button>
  );
}
