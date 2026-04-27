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

/**
 * Extrai a área de recorte do elemento <img> exibido e retorna base64.
 * Os valores de PixelCrop são em pixels do elemento renderizado —
 * escalonamos para o tamanho natural da imagem.
 */
export function getCroppedImg(
  imgEl: HTMLImageElement,
  crop: PixelCrop,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  quality = 0.92
): string {
  const scaleX = imgEl.naturalWidth  / imgEl.width;
  const scaleY = imgEl.naturalHeight / imgEl.height;

  const cropW = Math.round(crop.width  * scaleX);
  const cropH = Math.round(crop.height * scaleY);

  const canvas = document.createElement("canvas");
  canvas.width  = cropW;
  canvas.height = cropH;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    imgEl,
    Math.round(crop.x * scaleX),
    Math.round(crop.y * scaleY),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return canvas.toDataURL(mimeType, quality);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
