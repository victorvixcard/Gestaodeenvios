import { useState, useCallback, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Check, X, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { getCroppedImg, readFileAsDataUrl, normalizeImageFile } from "../../lib/cropImage";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  aspect?: number;           // 1 = quadrado/círculo, 16/9 = banner, undefined = livre
  cropShape?: "round" | "rect";
  title?: string;
  hint?: string;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect?: number
): Crop {
  if (!aspect) {
    // Livre: inicia com seleção de 80% da imagem
    return {
      unit: "%",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };
  }
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 85 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropModal({
  open,
  onClose,
  onSave,
  aspect,
  cropShape = "rect",
  title = "Ajustar imagem",
  hint,
}: Props) {
  const [imageSrc, setImageSrc]       = useState<string | null>(null);
  const [crop, setCrop]               = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving]           = useState(false);
  const [converting, setConverting]   = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const imgRef    = useRef<HTMLImageElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = "";
    await processFile(raw);
  };

  const processFile = async (raw: File) => {
    setConverting(true);
    try {
      const file   = await normalizeImageFile(raw);
      const dataUrl = await readFileAsDataUrl(file);
      setImageSrc(dataUrl);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } finally {
      setConverting(false);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const initial = centerAspectCrop(naturalWidth, naturalHeight, aspect);
    setCrop(initial);
  }, [aspect]);

  const handleSave = () => {
    if (!imgRef.current || !completedCrop || completedCrop.width === 0) return;
    setSaving(true);
    try {
      const url = getCroppedImg(imgRef.current, completedCrop);
      onSave(url);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    onClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />

        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[60] w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden focus:outline-none"
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

          {imageSrc ? (
            <>
              {/* Crop area */}
              <div className="bg-[#111] flex items-center justify-center p-3 overflow-auto max-h-[60vh]">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  circularCrop={cropShape === "round"}
                  keepSelection
                  minWidth={40}
                  minHeight={40}
                  style={{ maxHeight: "55vh", maxWidth: "100%" }}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Imagem para recortar"
                    onLoad={onImageLoad}
                    style={{ maxHeight: "55vh", maxWidth: "100%", display: "block" }}
                  />
                </ReactCrop>
              </div>

              {/* Tip */}
              <p className="text-[11px] text-muted-foreground text-center px-5 pt-3">
                Arraste as alças dos cantos e bordas para ajustar o recorte.
              </p>

              {/* Actions */}
              <div className="flex gap-2 px-5 pb-5 pt-3">
                <Button variant="outline" className="flex-1" onClick={() => setImageSrc(null)}>
                  Trocar foto
                </Button>
                <Button
                  variant="brand"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || !completedCrop || completedCrop.width === 0}
                >
                  <Check className="h-4 w-4" />
                  {saving ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </>
          ) : (
            /* Upload prompt */
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      PNG, JPG, WEBP, HEIC — qualquer formato
                    </p>
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
