import { useRef, useState } from "react";
import { Upload, X, RotateCcw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadImage, type ImageRef, type ImageType } from "@/lib/image-service";
import { cn } from "@/lib/utils";

type Status = "idle" | "preview" | "uploading" | "processing" | "done" | "error";

type Props = {
  type: ImageType;            // "logo" | "cover" | "dish" | "banner" | "avatar"
  value?: ImageRef | null;
  onChange?: (ref: ImageRef | null) => void;
  label?: string;
  className?: string;
  aspect?: string;            // e.g. "aspect-square" | "aspect-[16/9]"
};

/**
 * Restaurant-side image uploader with all the lifecycle states the brief asks for:
 * preview → uploading → processing → done, plus retry on failure and a clear
 * error message. Wraps the existing `uploadImage` service so swapping in
 * InsForge storage later requires zero changes here.
 */
export function ImageUploader({
  type, value, onChange, label = "Upload image", className, aspect = "aspect-square",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(value ? "done" : "idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(value?.image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const lastFile = useRef<File | null>(null);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      setStatus("error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8 MB.");
      setStatus("error");
      return;
    }
    lastFile.current = file;
    setError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStatus("preview");

    try {
      setStatus("uploading");
      const ref = await uploadImage(file, type);
      // Mock "server-side processing" step so the UI mirrors the future flow.
      setStatus("processing");
      await new Promise((r) => setTimeout(r, 350));
      setStatus("done");
      onChange?.(ref);
    } catch {
      setError("Upload failed. Check your connection and try again.");
      setStatus("error");
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const retry = () => {
    if (lastFile.current) void handleFile(lastFile.current);
    else pick();
  };

  const clear = () => {
    setPreviewUrl(null);
    setStatus("idle");
    setError(null);
    lastFile.current = null;
    onChange?.(null);
  };

  const busy = status === "uploading" || status === "processing";

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60",
          aspect,
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={pick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Upload className="h-6 w-6" />
            <span className="text-[12px] font-semibold">{label}</span>
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-foreground/90 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-background">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {status === "uploading" ? "Uploading…" : "Processing…"}
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        )}

        {previewUrl && !busy && (
          <button
            type="button"
            onClick={clear}
            aria-label="Remove image"
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-foreground/80 text-background"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {status === "error" && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] font-semibold text-destructive">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-destructive-foreground active:scale-95"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {status !== "error" && previewUrl && !busy && (
        <button
          type="button"
          onClick={pick}
          className="text-[11.5px] font-extrabold uppercase tracking-widest text-primary"
        >
          Replace image
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInput}
      />
    </div>
  );
}
