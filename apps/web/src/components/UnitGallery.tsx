import { useRef, useState } from "react";
import { Camera, Ruler } from "lucide-react";
import { useModalA11y } from "../hooks/useModalA11y";

interface UnitImage {
  id: string;
  url: string;
  caption?: string;
  type: "PHOTO" | "FLOOR_PLAN" | "FLOOR_MAP";
  sortOrder: number;
}

interface Props {
  images: UnitImage[];
  onDelete?: (imageId: string) => Promise<void>;
  onUpload?: () => void;
}

export default function UnitGallery({ images, onDelete, onUpload }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: lightboxIndex !== null,
    onClose: () => setLightboxIndex(null),
    containerRef: lightboxRef,
  });

  if (images.length === 0) return null;

  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null;

  const goToPrevious = () => {
    setLightboxIndex((idx) => {
      if (idx === null) return null;
      return idx === 0 ? images.length - 1 : idx - 1;
    });
  };

  const goToNext = () => {
    setLightboxIndex((idx) => {
      if (idx === null) return null;
      return idx === images.length - 1 ? 0 : idx + 1;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    else if (e.key === "ArrowRight") goToNext();
    else if (e.key === "Escape") setLightboxIndex(null);
  };

  return (
    <>
      {/* Thumbnail strip */}
      <div className="px-6 py-3 border-b border-border">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, idx) => (
            <div key={img.id} className="flex-shrink-0 relative group">
              <button
                onClick={() => setLightboxIndex(idx)}
                className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                  lightboxIndex === idx ? "border-primary/40" : "border-border"
                } hover:border-primary/40`}
              >
                <img src={img.url} alt={img.caption || "Unit"} className="w-full h-full object-cover" />
              </button>
              {onDelete && (
                <button
                  onClick={async () => {
                    setDeleting(img.id);
                    try {
                      await onDelete(img.id);
                    } finally {
                      setDeleting(null);
                    }
                  }}
                  disabled={deleting === img.id}
                  className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Delete image"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {onUpload && (
            <button
              onClick={onUpload}
              className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-info-soft flex items-center justify-center text-2xl transition-colors"
              title="Upload image"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Lightbox overlay */}
      {currentImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={currentImage.caption || "Unit image"}
        >
          <div
            ref={lightboxRef}
            tabIndex={-1}
            className="bg-black rounded-lg max-w-4xl w-full overflow-hidden focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox content */}
            <div className="relative">
              <img src={currentImage.url} alt={currentImage.caption || "Unit"} className="w-full h-auto max-h-[70vh] object-contain" />

              {/* Type badge */}
              <span className="absolute top-4 left-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-900/70 text-white inline-flex items-center gap-1.5">
                {currentImage.type === "PHOTO" ? (
                  <Camera className="size-3" aria-hidden="true" />
                ) : (
                  <Ruler className="size-3" aria-hidden="true" />
                )}
                {currentImage.type === "PHOTO" ? "Photo" : "Floor plan"}
              </span>

              {/* Navigation buttons */}
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
              >
                ←
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
              >
                →
              </button>

              {/* Close button */}
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
              >
                ✕
              </button>

              {/* Counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/70 text-white text-xs px-3 py-1.5 rounded-full">
                {lightboxIndex! + 1} / {images.length}
              </div>
            </div>

            {/* Caption */}
            {currentImage.caption && (
              <div className="bg-card px-4 py-3 text-sm text-foreground">{currentImage.caption}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
