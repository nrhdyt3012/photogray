import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  // Layar booth (tamu, tanpa login). Satu URL per ruangan.
  route("booth/:code", "routes/booth.$code.tsx"),
  route("photo/:id", "routes/photo.$id.tsx"),
  route("measure-frames", "routes/measure-frames.tsx"),
  route("api/staff", "routes/api.staff.ts"),

  // Panel kasir & owner
  route("admin", "routes/admin.tsx", [
    index("routes/admin/kasir.tsx"),
    route("laporan", "routes/admin/laporan.tsx"),
    route("ruangan", "routes/admin/ruangan.tsx"),
    route("paket", "routes/admin/paket.tsx"),
    route("frame", "routes/admin/frame.tsx"),
    route("cabang", "routes/admin/cabang.tsx"),
    route("staf", "routes/admin/staf.tsx"),
  ]),
] satisfies RouteConfig;
