import { useState } from "react";
import { Camera } from "lucide-react";
import { ImageCropModal } from "./ImageCropModal";
import { cn } from "../../lib/utils";

interface Props {
  currentUrl?: string;
  initials?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  shape?: "round" | "rect";
  aspect?: number;
  title?: string;
  hint?: string;
  onSave: (url: string) => void;
  className?: string;
}

const SIZE = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-xl",
  lg: "h-24 w-24 text-2xl",
};

export function AvatarUpload({
  currentUrl,
  initials = "??",
  color = "#6366f1",
  size = "md",
  shape = "round",
  aspect = 1,
  title,
  hint,
  onSave,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const rounded = shape === "round" ? "rounded-full" : "rounded-xl";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative group flex-shrink-0 focus:outline-none",
          SIZE[size],
          rounded,
          className
        )}
        aria-label="Trocar imagem"
      >
        {/* Avatar / Image */}
        {currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            className={cn("w-full h-full object-cover", rounded)}
          />
        ) : (
          <div
            className={cn("w-full h-full flex items-center justify-center font-bold text-white", rounded)}
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity",
            rounded
          )}
        >
          <Camera className="h-1/3 w-1/3 text-white" />
        </div>
      </button>

      <ImageCropModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={(url) => { onSave(url); setOpen(false); }}
        aspect={aspect}
        cropShape={shape}
        title={title ?? "Ajustar imagem"}
        hint={hint}
      />
    </>
  );
}
