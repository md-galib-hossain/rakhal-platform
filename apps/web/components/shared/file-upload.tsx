"use client"; // drag/drop + client-side validation + object-URL preview

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Progress } from "@/components/ui/progress";

export interface FileUploadProps {
  /** e.g. "image/png,image/jpeg" or ".csv" — passed straight to the input's `accept`. */
  accept?: string;
  maxSizeBytes?: number;
  /** Show an image preview thumbnail (cattle photo). Set false for non-image uploads (CSV import). */
  imagePreview?: boolean;
  /** 0-100 while an upload request is in flight; omit/undefined when idle. */
  progress?: number;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onClear?: () => void;
  className?: string;
  label?: string;
}

/** Client type/size-validated file picker with drag-and-drop, preview, and progress — cattle photo, CSV import, task photo. */
export function FileUpload({
  accept,
  maxSizeBytes = 10 * 1024 * 1024,
  imagePreview = false,
  progress,
  disabled = false,
  onFileSelected,
  onClear,
  className,
  label = "Drop a file here, or click to browse",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | null) {
    const next = fileList?.[0];
    if (!next) return;
    if (next.size > maxSizeBytes) {
      setError(`File is too large (max ${Math.round(maxSizeBytes / (1024 * 1024))}MB)`);
      return;
    }
    setError(null);
    setFile(next);
    if (imagePreview && next.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(next));
    }
    onFileSelected(next);
  }

  function clear() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-8 text-center transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="size-6 text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">{label}</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- transient local object-URL preview, next/image can't handle blob: URLs
            <img src={previewUrl} alt="" className="size-12 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            {typeof progress === "number" ? <Progress value={progress} className="mt-1.5 h-1.5" /> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={clear} disabled={disabled} aria-label="Remove file">
            <X className="size-4" />
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
