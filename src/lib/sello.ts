import selloSvg from "../assets/logo.svg?raw";

/** SVG vectorial puro del sello ovalado de la parroquia. */
export function selloSvgRaw(): string {
  return selloSvg;
}

let pngCache: string | null = null;

/**
 * Rasteriza el sello a PNG en alta resolución para incrustarlo en el PDF
 * descargable (@react-pdf/renderer no soporta textPath curvo).
 * La versión imprimible HTML usa el SVG vectorial puro.
 */
export async function selloPng(ancho = 1000): Promise<string> {
  if (pngCache) return pngCache;

  const vb = selloSvg.match(/viewBox="([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"/);
  const vbW = vb ? Number(vb[3]) : 500;
  const vbH = vb ? Number(vb[4]) : 700;
  const alto = Math.round((ancho * vbH) / vbW);
  // El archivo trae width/height relativos: se reemplazan por píxeles fijos
  // para que el <img> tenga tamaño intrínseco al rasterizar.
  const sized = selloSvg.replace(/<svg[^>]*>/, (tag) => {
    const limpio = tag
      .replace(/\s(width|height)="[^"]*"/g, "")
      .replace(/>$/, "");
    return `${limpio} width="${ancho}" height="${alto}">`;
  });

  const url = URL.createObjectURL(
    new Blob([sized], { type: "image/svg+xml;charset=utf-8" })
  );
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("No se pudo cargar el sello."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || ancho;
    canvas.height = img.naturalHeight || alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sin canvas.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    pngCache = canvas.toDataURL("image/png");
    return pngCache;
  } finally {
    URL.revokeObjectURL(url);
  }
}
