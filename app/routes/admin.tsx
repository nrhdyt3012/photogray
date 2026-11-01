import { useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "~/lib/auth";
import { getSupabase } from "~/lib/supabase/client";
import type { Branch } from "~/lib/supabase/types";
import type { AdminContext } from "~/components/admin/context";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: "Panel | Snap & Go" }];
}

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Kasir", end: true },
  { to: "/admin/laporan", label: "Laporan" },
  { to: "/admin/ruangan", label: "Ruangan" },
  { to: "/admin/paket", label: "Paket" },
  { to: "/admin/frame", label: "Frame" },
];
const OWNER_NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin/cabang", label: "Cabang" },
  { to: "/admin/staf", label: "Akun staf" },
];
// Halaman owner yang tetap bisa dibuka walau belum ada cabang
const OWNER_PATH = /^\/admin\/(cabang|staf)/;

export default function AdminLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");

  const reloadBranches = useCallback(async () => {
    const { data } = await getSupabase().from("branches").select("*").order("name");
    const list = (data ?? []) as Branch[];
    setBranches(list);
    setBranchId((cur) => (list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    if (profile) reloadBranches();
  }, [profile, reloadBranches]);

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-slate-700">Akun ini belum punya peran atau sudah dinonaktifkan. Hubungi owner.</p>
          <button onClick={signOut} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Keluar</button>
        </div>
      </main>
    );
  }

  const isOwner = profile.role === "owner";
  const ctx: AdminContext = {
    profile,
    isOwner,
    branches,
    branchId: isOwner ? branchId : profile.branch_id ?? "",
    setBranchId,
    reloadBranches,
  };
  const currentBranch = branches.find((b) => b.id === ctx.branchId);
  const canShowPage = !!ctx.branchId || (isOwner && OWNER_PATH.test(pathname));

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <aside className="flex shrink-0 flex-col gap-6 bg-slate-900 p-4 text-slate-200 md:min-h-screen md:w-60">
        <div>
          <p className="font-display text-2xl font-bold text-white">Snap &amp; Go</p>
          <p className="text-xs text-slate-400">{isOwner ? "Owner" : "Kasir"} · {profile.full_name}</p>
        </div>

        {isOwner ? (
          <label className="block space-y-1 text-xs text-slate-400">
            Cabang aktif
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-white"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">{currentBranch?.name ?? "..."}</p>
        )}

        <nav className="flex flex-wrap gap-1 md:flex-col">
          {[...NAV, ...(isOwner ? OWNER_NAV : [])].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "rounded-lg border-l-4 px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-amber-300 bg-slate-800 text-white"
                    : "border-transparent hover:bg-slate-800/60",
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={signOut} className="mt-auto rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">
          Keluar
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        {canShowPage ? (
          <Outlet context={ctx} />
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
            {isOwner ? (
              <>Belum ada cabang. Buka menu <b>Cabang</b> untuk menambahkan cabang pertama.</>
            ) : (
              "Memuat cabang..."
            )}
          </p>
        )}
      </main>
    </div>
  );
}
