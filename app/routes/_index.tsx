import { Link } from "react-router";

export function meta() {
  return [{ title: "Snap & Go Photobooth" }];
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-8 text-center text-white">
      <h1 className="font-display text-6xl font-bold tracking-tight">Snap &amp; Go</h1>
      <p className="mt-3 max-w-md text-slate-300">
        Layar booth dibuka lewat alamat khusus tiap ruangan. Petugas bisa menyalinnya dari menu
        Ruangan di panel kasir.
      </p>
      <Link
        to="/admin"
        className="mt-8 rounded-full bg-amber-300 px-8 py-3 font-semibold text-slate-900 transition hover:bg-amber-200"
      >
        Masuk panel kasir / owner
      </Link>
    </main>
  );
}
