import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, Loader2, ImageIcon, AlertCircle } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: "events" | "venues" | "categories" | "users" | "misc";
  label?: string;
  aspectRatio?: "square" | "video" | "banner" | "auto";
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
};

export function ImageUpload({
  value,
  onChange,
  folder,
  label = "Upload image",
  aspectRatio = "auto",
  maxSizeMB = 10,
  className,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClass = {
    square: "aspect-square",
    video: "aspect-video",
    banner: "aspect-[3/1]",
    auto: "",
  }[aspectRatio];

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate type
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size: ${maxSizeMB}MB`);
        return;
      }

      setIsUploading(true);

      try {
        const result = await api.uploadFile(file, folder);
        onChange(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [folder, maxSizeMB, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isUploading, handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const imageUrl = value
    ? value.startsWith("http")
      ? value
      : `${API_BASE_URL}${value}`
    : null;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-200">{label}</label>
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border-2 border-dashed transition-colors",
          aspectRatioClass,
          isDragging
            ? "border-cyan-500 bg-cyan-500/10"
            : value
            ? "border-white/20 bg-white/5"
            : "border-white/10 bg-white/5 hover:border-white/20",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {imageUrl ? (
          // Image preview
          <div className="group relative h-full min-h-[120px]">
            <img
              src={imageUrl}
              alt="Preview"
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Upload placeholder
          <button
            type="button"
            className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 p-4"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <span className="text-sm text-slate-400">Uploading...</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-slate-500" />
                <span className="text-sm text-slate-400">
                  Drag & drop or click to upload
                </span>
                <span className="text-xs text-slate-500">
                  JPEG, PNG, WebP, GIF (max {maxSizeMB}MB)
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}

// Gallery upload for multiple images
type GalleryUploadProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: "events" | "venues" | "categories" | "users" | "misc";
  label?: string;
  maxImages?: number;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
};

export function GalleryUpload({
  value = [],
  onChange,
  folder,
  label = "Gallery images",
  maxImages = 10,
  maxSizeMB = 10,
  className,
  disabled = false,
}: GalleryUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setError(null);

    const remainingSlots = maxImages - value.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    // Validate files
    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File "${file.name}" too large. Maximum size: ${maxSizeMB}MB`);
        return;
      }
    }

    setIsUploading(true);

    try {
      const result = await api.uploadMultipleFiles(filesToUpload, folder);
      const newUrls = result.uploaded.map((u) => u.url);
      onChange([...value, ...newUrls]);

      if (result.errors && result.errors.length > 0) {
        setError(result.errors.join(", "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleRemove = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-200">
          {label}
          <span className="ml-2 text-slate-500">
            ({value.length}/{maxImages})
          </span>
        </label>
      )}

      <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
        {value.map((url, index) => {
          const imageUrl = url.startsWith("http")
            ? url
            : `${API_BASE_URL}${url}`;

          return (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded-lg border border-white/10"
            >
              <img
                src={imageUrl}
                alt={`Gallery ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleRemove(index)}
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
          );
        })}

        {value.length < maxImages && !disabled && (
          <button
            type="button"
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-white/10 bg-white/5 transition-colors hover:border-white/20"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            ) : (
              <Upload className="h-6 w-6 text-slate-500" />
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}
