import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "~/components/admin/context";
import { Btn, Card, Empty, PageHeader, StatusBadge, TextInput } from "~/components/admin/ui";
import { getSupabase } from "~/lib/supabase/client";
import type { Room, Transaction } from "~/lib/supabase/types";
import {
  addDays,
  dayRange,
  formatDateLong,
  formatRupiah,
  formatTime,
  PAYMENT_LABEL,
  todayWib,
} from "~/lib/format";
import { cn } from "~/lib/utils";

const counted = (t: Transaction) => t.status !== "cancelled";

export default function Laporan() {
  const { isOwner, branches, branchId } = useAdmin();
  const [date, setDate] = useState(todayWib());
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  // Owner: null = ringkasan semua cabang, id = detail satu cabang
  const [openBranch, setOpenBranch] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { from, to } = dayRange(date);
    const [t, r] = await Promise.all([
      sb.from("transactions").select("*").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: false }),
      sb.from("rooms").select("*"),
    ]);
    setTxns((t.data ?? []) as Transaction[]);
    setRooms((r.data ?? []) as Room[]);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
    // Hari ini diperbarui otomatis, hari lain cukup sekali
    if (date !== todayWib()) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load, date]);

  const today = todayWib();
  const detailBranchId = isOwner ? openBranch : branchId;
  const detail = useMemo(
    () => (detailBranchId ? txns.filter((t) => t.branch_id === detailBranchId) : []),
    [txns, detailBranchId],
  );

  return (
    <>
      <PageHeader title="Laporan" hint={formatDateLong(date)} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Btn variant={date === today ? "primary" : "ghost"} onClick={() => setDate(today)}>Hari ini</Btn>
        <Btn variant={date === addDays(today, -1) ? "primary" : "ghost"} onClick={() => setDate(addDays(today, -1))}>Kemarin</Btn>
        <TextInput
          type="date"
          aria-label="Pilih tanggal"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {loading ? (
        <p className="text-slate-500">Memuat...</p>
      ) : isOwner && !openBranch ? (
        <BranchOverview
          branches={branches.map((b) => ({ id: b.id, name: b.name, city: b.city }))}
          txns={txns}
          onOpen={setOpenBranch}
        />
      ) : (
        <>
          {isOwner && (
            <button onClick={() => setOpenBranch(null)} className="mb-4 text-sm font-medium text-slate-700 underline underline-offset-4">
              ← Semua cabang
            </button>
          )}
          <BranchDetail
            title={branches.find((b) => b.id === detailBranchId)?.name ?? ""}
            txns={detail}
            rooms={rooms}
          />
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function BranchOverview({
  branches,
  txns,
  onOpen,
}: {
  branches: { id: string; name: string; city: string }[];
  txns: Transaction[];
  onOpen: (id: string) => void;
}) {
  const all = txns.filter(counted);
  const revenue = all.reduce((s, t) => s + t.price, 0);
  return (
    <div className="space-y-6">
      <Card className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Stat label="Total pendapatan" value={formatRupiah(revenue)} />
        <Stat label="Total transaksi" value={String(all.length)} />
        <Stat label="Cabang aktif hari ini" value={String(new Set(all.map((t) => t.branch_id)).size)} />
      </Card>

      {branches.length === 0 ? (
        <Empty>Belum ada cabang.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => {
            const mine = txns.filter((t) => t.branch_id === b.id && counted(t));
            const sum = mine.reduce((s, t) => s + t.price, 0);
            return (
              <button
                key={b.id}
                onClick={() => onOpen(b.id)}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-900 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <p className="font-display text-xl font-semibold">{b.name}</p>
                <p className="text-xs text-slate-500">{b.city}</p>
                <p className="mt-4 font-display text-3xl font-semibold tabular-nums">{formatRupiah(sum)}</p>
                <p className="text-sm text-slate-600">{mine.length} transaksi · lihat detail</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BranchDetail({ title, txns, rooms }: { title: string; txns: Transaction[]; rooms: Room[] }) {
  const valid = txns.filter(counted);
  const revenue = valid.reduce((s, t) => s + t.price, 0);
  const byPayment = (m: "cash" | "qris") =>
    valid.filter((t) => t.payment_method === m).reduce((s, t) => s + t.price, 0);
  const byPackage = useMemo(() => {
    const map = new Map<string, { count: number; sum: number }>();
    valid.forEach((t) => {
      const cur = map.get(t.package_name) ?? { count: 0, sum: 0 };
      map.set(t.package_name, { count: cur.count + 1, sum: cur.sum + t.price });
    });
    return [...map.entries()];
  }, [valid]);
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      {title && <h2 className="font-display text-2xl font-semibold">{title}</h2>}
      <Card className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Pendapatan" value={formatRupiah(revenue)} />
        <Stat label="Transaksi" value={String(valid.length)} />
        <Stat label="Tunai" value={formatRupiah(byPayment("cash"))} />
        <Stat label="QRIS" value={formatRupiah(byPayment("qris"))} />
      </Card>

      {byPackage.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Per paket</h3>
          <ul className="space-y-1 text-sm">
            {byPackage.map(([name, v]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="tabular-nums text-slate-600">{v.count}× · {formatRupiah(v.sum)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <h3 className="mb-3 text-sm font-semibold">Detail transaksi</h3>
        {txns.length === 0 ? (
          <Empty>Tidak ada transaksi pada tanggal ini.</Empty>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Jam</th>
                <th className="py-2 pr-3 font-medium">Ruangan</th>
                <th className="py-2 pr-3 font-medium">Paket</th>
                <th className="py-2 pr-3 font-medium">Bayar</th>
                <th className="py-2 pr-3 text-right font-medium">Harga</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className={cn("border-b border-slate-100", t.status === "cancelled" && "text-slate-400 line-through")}>
                  <td className="py-2 pr-3 tabular-nums">{formatTime(t.created_at)}</td>
                  <td className="py-2 pr-3">{roomName(t.room_id)}</td>
                  <td className="py-2 pr-3">{t.package_name}</td>
                  <td className="py-2 pr-3">{PAYMENT_LABEL[t.payment_method]}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(t.price)}</td>
                  <td className="py-2 no-underline"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
