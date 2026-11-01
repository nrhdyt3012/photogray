import type { Route } from "./+types/booth.$code";
import { BoothContainer } from "~/components/booth/BoothContainer";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Snap & Go Photobooth" },
    { name: "viewport", content: "width=device-width, initial-scale=1, user-scalable=no" },
    { name: "robots", content: "noindex" },
  ];
}

// Webcam dan model segmentasi hanya jalan di browser, jadi layar booth tidak dirender di server
export default function BoothRoute({ params }: Route.ComponentProps) {
  return (
    <div className="w-full min-h-screen">
      <BoothContainer code={params.code} />
    </div>
  );
}
