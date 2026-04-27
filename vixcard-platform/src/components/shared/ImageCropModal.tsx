import { useState, useCallback, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Cropper from "react-easy-crop";
import { ZoomIn, ZoomOut, RotateCw, Check, X, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { getCroppedImg, readFileAsDataUrl, normalizeImageFile } from "../../lib/cropImage";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  aspect?: number;
  cropShape?: "round" | "rect";
  title?: string;
  hint?: string;
}

export function ImageCropModal({
  open,
  onClose,
  onSave,
  aspect = 1,
  cropShape = "round",
  title = "Ajustar imagem",
  hint,
}: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";
    await processFile(raw);
  };

  const processFile = async (raw: File) => {
    setConverting(true);
    try {
      const file = await normalizeImageFile(raw);
      const dataUrl = await readFileAsDataUrl(file);
      setImageSrc(dataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    setSaving(true);
    try {
      const url = await getCroppedImg(imageSrc, croppedArea, rotation);
      onSave(url);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />

        {/* Sheet / Dialog */}
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[60] w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden focus:outline-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <DialogPrimitive.Title className="font-display text-base font-bold">
              {title}
            </DialogPrimitive.Title>
            <button
              onClick={handleClose}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Crop area — altura proporcional ao aspect ratio, mín 220 máx 360 */}
          {imageSrc ? (
            <>
              <div
                className="relative w-full"
                style={{ height: Math.min(360, Math.max(220, Math.round(320 / aspect))) }}
              >
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  cropShape={cropShape}
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{
                    containerStyle: { background: "#111" },
                  }}
                />
              </div>

              {/* Controls */}
              <div className="px-5 pt-4 pb-2 space-y-3">
                <div className="flex items-center gap-3">
                  <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
                  />
                  <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>

                <div className="flex items-center gap-3">
                  <RotateCw className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {rotation}°
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-5 pb-5 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setImageSrc(null)}>
                  Trocar foto
                </Button>
                <Button variant="brand" className="flex-1" onClick={handleSave} disabled={saving}>
                  <Check className="h-4 w-4" />
                  {saving ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 flex flex-col items-center gap-4">
              {hint && (
                <p className="text-xs text-muted-foreground text-center">{hint}</p>
              )}

              {converting && (
                <div className="w-full flex flex-col items-center gap-2 py-6">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-sm text-muted-foreground">Convertendo HEIC…</p>
                </div>
              )}

              {!converting && (
                <div
                  className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (!file) return;
                    await processFile(file);
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Clique ou arraste a imagem</p>
                    <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP, HEIC — qualquer formato</p>
                  </div>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
