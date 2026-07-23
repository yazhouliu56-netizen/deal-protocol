"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { uploadPhotoWithRetry } from "@/lib/upload"
import type { VerificationStatus } from "@/lib/types"
import {
  Shield, ShieldCheck, ShieldX, Clock, Upload, X,
  ChevronRight, Loader2, CheckCircle2, ArrowRight,
} from "lucide-react"

function VerificationForm({
  status,
  rejectedReason,
  onSubmitted,
}: {
  status: VerificationStatus
  rejectedReason: string | null
  onSubmitted: () => void
}) {
  const router = useRouter()
  const [realName, setRealName] = useState("")
  const [idNumber, setIdNumber] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selected])
    selected.forEach((f) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(f)
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!realName.trim() || !idNumber.trim()) {
      toast.error("请填写真实姓名和身份证号")
      return
    }
    if (files.length === 0) {
      toast.error("请上传至少一张身份证或证书图片")
      return
    }

    setUploading(true)
    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      let attempts = 0
      const maxRetries = 3

      while (attempts <= maxRetries) {
        try {
          if (attempts > 0) {
            toast.loading(`正在尝试重试第 ${attempts} 次...`, { id: `upload-retry-${i}` })
          }
          const url = await uploadPhotoWithRetry(file, "verification", maxRetries - attempts)
          uploadedUrls.push(url)
          if (attempts > 0) {
            toast.success(`第 ${i + 1} 张图片上传成功`, { id: `upload-retry-${i}` })
          }
          break
        } catch {
          attempts++
          if (attempts > maxRetries) {
            toast.error(`第 ${i + 1} 张图片上传失败，请重试`, { id: `upload-retry-${i}` })
            setUploading(false)
            return
          }
          toast.loading(`上传失败，正在重试第 ${attempts} 次...`, { id: `upload-retry-${i}` })
          await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000))
        }
      }
    }

    try {
      const res = await fetch("/api/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realName: realName.trim(), idNumber: idNumber.trim(), certificates: uploadedUrls }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "提交失败")
        setUploading(false)
        return
      }
      toast.success("资料已提交审核！")
      onSubmitted()
      router.refresh()
    } catch {
      toast.error("网络错误，请稍后重试")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {status === "rejected" && rejectedReason && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldX className="mt-0.5 size-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-400">审核未通过</p>
              <p className="mt-0.5 text-sm text-red-300/80">{rejectedReason}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
          真实姓名
        </label>
        <input
          type="text"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          placeholder="请输入与身份证一致的姓名"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
          身份证号
        </label>
        <input
          type="text"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="请输入18位公民身份证号码"
          maxLength={18}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
          身份证正反面 / 技能证书
        </label>
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, idx) => (
            <div key={idx} className="relative aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700">
              <Image src={preview} alt={`证书 ${idx + 1}`} fill className="object-cover" />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label={`移除证书 ${idx + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {previews.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[3/2] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-400 dark:border-zinc-600 dark:hover:border-indigo-400"
              aria-label="上传证书图片"
            >
              <Upload className="size-5" />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
          支持 JPG / PNG 格式，最多 5 张
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={uploading}
        className="w-full rounded-xl py-6 text-sm font-bold"
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            上传中...
          </>
        ) : (
          <>
            提交审核 <ChevronRight className="ml-1 size-4" />
          </>
        )}
      </Button>
    </div>
  )
}

export default function VerificationPage() {
  const router = useRouter()
  const [status, setStatus] = useState<VerificationStatus | null>(null)
  const [rejectedReason, setRejectedReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/profile")
      const data = await res.json()
      const profile = data.user
      setStatus(profile.verification_status || "unverified")
      setRejectedReason(profile.verification_rejected_reason || null)
    } catch {
      toast.error("加载用户信息失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-start justify-center bg-slate-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg">
        {status === "approved" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
              <ShieldCheck className="size-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              恭喜！您已通过实名身份认证
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              您的账户已获得完整信用授信，现在可以正常接单了
            </p>
            <Button
              onClick={() => router.push("/provider")}
              className="mt-8 rounded-xl"
            >
              返回服务商控制台 <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        ) : status === "pending" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
              <Clock className="size-10 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              资料审核中
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              您的实名认证资料正在人工审核中，预计 1-2 个工作日完成
            </p>
            <div className="mt-8 flex items-center justify-center gap-1">
              <span className="flex size-2 rounded-full bg-amber-400" />
              <span className="flex size-2 animate-pulse rounded-full bg-amber-400" />
              <span className="flex size-2 animate-pulse rounded-full bg-amber-400" style={{ animationDelay: "0.3s" }} />
              <span className="flex size-2 animate-pulse rounded-full bg-amber-400" style={{ animationDelay: "0.6s" }} />
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">已提交信息</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-500 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>审核状态</span>
                  <span className="font-medium text-amber-500">审核中</span>
                </div>
                <div className="flex justify-between">
                  <span>提交时间</span>
                  <span className="font-medium text-slate-700 dark:text-zinc-300">待确认</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => router.push("/provider")}
              className="mt-6 rounded-xl"
            >
              返回服务商控制台
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
                <Shield className="size-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">实名身份认证</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                {status === "rejected"
                  ? "请根据审核意见修改后重新提交"
                  : "完成认证后即可接单并获得平台担保交易服务"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <VerificationForm
                status={status || "unverified"}
                rejectedReason={rejectedReason}
                onSubmitted={fetchStatus}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
