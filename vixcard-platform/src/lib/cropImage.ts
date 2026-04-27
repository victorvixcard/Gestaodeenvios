import heic2any from "heic2any";

type CropArea = { x: number; y: number; width: number; height: number };

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

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

/**
 * Renders the rotated image onto an intermediate canvas, then extracts
 * the crop area with the correct output dimensions (preserving aspect ratio).
 *
 * @param outputMaxSide  Largest side of the output in pixels (default 1024)
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation = 0,
  outputMaxSide = 1024,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  quality = 0.92
): Promise<string> {
  const image = await createImage(imageSrc);

  // ── 1. Rotate the full image onto an intermediate canvas ──────────────────
  const rotRad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rotRad));
  const cos = Math.abs(Math.cos(rotRad));

  // Bounding box of the rotated image
  const bBoxW = Math.round(cos * image.width  + sin * image.height);
  const bBoxH = Math.round(sin * image.width  + cos * image.height);

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width  = bBoxW;
  rotCanvas.height = bBoxH;
  const rotCtx = rotCanvas.getContext("2d")!;

  // Translate to center, rotate, draw
  rotCtx.translate(bBoxW / 2, bBoxH / 2);
  rotCtx.rotate(rotRad);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // ── 2. Extract crop area preserving its aspect ratio ─────────────────────
  const cropAspect = pixelCrop.width / pixelCrop.height;
  const outW = cropAspect >= 1
    ? outputMaxSide
    : Math.round(outputMaxSide * cropAspect);
  const outH = cropAspect >= 1
    ? Math.round(outputMaxSide / cropAspect)
    : outputMaxSide;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width  = outW;
  cropCanvas.height = outH;
  const cropCtx = cropCanvas.getContext("2d")!;

  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  );

  return cropCanvas.toDataURL(mimeType, quality);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
