"use client"

import { useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MediaFile {
  url: string
  name: string
  type: "image" | "video"
}

interface MediaPickerProps {
  value: MediaFile[]
  onChange: (files: MediaFile[]) => void
  maxFiles?: number
}

export function MediaPicker({ value, onChange, maxFiles = 3 }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setPreview((prev) => [...prev, ...newPreviews])

    const newMedia = files.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      type: (f.type.startsWith("video") ? "video" : "image") as MediaFile["type"],
    }))
    onChange([...value, ...newMedia].slice(0, maxFiles))
  }

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(preview[idx])
    setPreview((prev) => prev.filter((_, i) => i !== idx))
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {preview.map((url, idx) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
            {value[idx]?.type === "video" ? (
              <video src={url} className="h-full w-full object-cover" />
            ) : (
              <img src={url} alt="" className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => removeFile(idx)}
              className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white"
              aria-label={`移除第 ${idx + 1} 个文件`}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {value.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20",
              value.length === 0 && "w-full h-24"
            )}
            aria-label="上传照片或视频"
          >
            <Camera className="size-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {value.length === 0 ? "点击上传照片或视频" : "继续添加"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
