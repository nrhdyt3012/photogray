import type { PhotoSlot } from "~/lib/frame-config";

/**
 * Mencari kotak foto otomatis dari frame PNG: kotak foto adalah area transparan
 * yang terpisah. Hasilnya diurutkan atas->bawah (vertikal) atau kiri->kanan (horizontal).
 * Hasil hanya tebakan awal; kasir bisa mengoreksi angkanya di form.
 */
export async function detectSlots(file: Blob): Promise<{ width: number; height: number; slots: PhotoSlot[] }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Gambar tidak bisa dibaca"));
      i.src = url;
    });
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const scale = Math.min(1, 500 / Math.max(W, H));
    const w = Math.max(1, Math.round(W * scale));
    const h = Math.max(1, Math.round(H * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    const hole = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) hole[i] = px[i * 4 + 3] < 25 ? 1 : 0;

    const seen = new Uint8Array(w * h);
    const found: (PhotoSlot & { area: number })[] = [];
    const stack: number[] = [];
    for (let start = 0; start < w * h; start++) {
      if (!hole[start] || seen[start]) continue;
      let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        const x = p % w, y = (p / w) | 0;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const n of [p - 1, p + 1, p - w, p + w]) {
          if (n < 0 || n >= w * h || seen[n] || !hole[n]) continue;
          if ((n === p - 1 && x === 0) || (n === p + 1 && x === w - 1)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      // Abaikan bintik kecil (mis. lubang dekorasi) di bawah 1.5% luas gambar
      if (area > w * h * 0.015) {
        found.push({
          x: Math.round(minX / scale),
          y: Math.round(minY / scale),
          width: Math.round((maxX - minX + 1) / scale),
          height: Math.round((maxY - minY + 1) / scale),
          area,
        });
      }
    }
    const horizontal = W > H;
    found.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    return { width: W, height: H, slots: found.map(({ area: _a, ...s }) => s) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
