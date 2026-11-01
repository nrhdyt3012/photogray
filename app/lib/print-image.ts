/** Cetak satu gambar lewat dialog print browser (iframe tersembunyi). */
export function printImage(url: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><style>@page{size:4in 6in;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${url}"></body></html>`,
  );
  doc.close();

  const img = doc.querySelector('img');
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 5000);
  };
  if (!img || img.complete) go();
  else {
    img.onload = go;
    img.onerror = () => iframe.remove();
  }
}
