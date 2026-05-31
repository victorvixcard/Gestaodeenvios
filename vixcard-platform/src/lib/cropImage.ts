import heic2any from "heic2any";
import type { PixelCrop } from "react-image-crop";

function isHeic(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    ext === "heic" ||
    ext === "heif"
  );
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
    type: "image/jpeg",
  });
}

/** Dimensão máxima do canvas de saída (px). Evita base64 gigantesco. */
const MAX_OUTPUT_PX = 1200;

/**
 * Extrai a área de recorte do elemento <img> exibido e retorna base64.
 * Os valores de PixelCrop são em pixels do elemento renderizado —
 * escalonamos para o tamanho natural e limitamos a MAX_OUTPUT_PX.
 */
export function getCroppedImg(
  imgEl: HTMLImageElement,
  crop: PixelCrop,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  quality = 0.88
): string {
  const scaleX = imgEl.naturalWidth  / imgEl.width;
  const scaleY = imgEl.naturalHeight / imgEl.height;

  let outW = Math.round(crop.width  * scaleX);
  let outH = Math.round(crop.height * scaleY);

  // Reduz proporcionalmente se exceder o limite
  if (outW > MAX_OUTPUT_PX || outH > MAX_OUTPUT_PX) {
    const ratio = Math.min(MAX_OUTPUT_PX / outW, MAX_OUTPUT_PX / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width  = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    imgEl,
    Math.round(crop.x * scaleX),
    Math.round(crop.y * scaleY),
    Math.round(crop.width  * scaleX),
    Math.round(crop.height * scaleY),
    0, 0, outW, outH
  );

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Retorna o tamanho aproximado em MB de um data URL base64.
 * Útil para validar antes de enviar ao backend.
 */
export function getBase64SizeMB(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? dataUrl;
  return (base64.length * 0.75) / (1024 * 1024);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
