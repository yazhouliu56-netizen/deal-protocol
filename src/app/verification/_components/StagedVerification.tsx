"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/base/platform/toast";
import { Button } from "@/components/ui/button";
import { uploadPhotoWithRetry } from "@/lib/upload";
import { Check, ChevronRight, Loader2, ShieldCheck, Upload, X } from "lucide-react";

export interface StageState {
  phoneDone: boolean;
  idDone: boolean;
  faceDone: boolean;
  approved: boolean;
}

/**
 * 三步渐进实名（P2-b 只做实名 · 用户裁决：分步骤引导，一上全量劝退）。
 * 每步独立提交（手机去登录页 SMS／身份证件／人脸照），服务端分件校验、
 * 齐活系统直批；证书为可选加分项（旧单表能力保留）。各步 403/400 原样吐司。
 */
export default function StagedVerification({
  stage,
  onChanged,
}: {
  stage: StageState;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [realName, setRealName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const post = async (body: Record<string, unknown>, okMsg: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast(data?.error || "提交失败", "error");
        return false;
      }
      toast(okMsg, "success");
      onChanged();
      router.refresh();
      return true;
    } catch {
      toast("网络错误，请稍后重试", "error");
      return false;
    }
  };

  const submitId = async () => {
    if (!realName.trim() || !idNumber.trim()) {
      toast("请填写真实姓名和身份证号", "error");
      return;
    }
    setBusy("id");
    try {
      await post({ realName: realName.trim(), idNumber: idNumber.trim() }, "身份证件已提交核验");
    } finally {
      setBusy(null);
    }
  };

  const submitFace = async () => {
    if (!faceFile) {
      toast("请先拍摄/上传一张正脸照片", "error");
      return;
    }
    setBusy("face");
    try {
      const url = await uploadPhotoWithRetry(faceFile, "verification", 3);
      await post({ faceImageUrl: url }, "人脸照片已提交核验");
      setFaceFile(null);
    } catch {
      toast("人脸照片上传失败，请重试", "error");
    } finally {
      setBusy(null);
    }
  };

  const submitCerts = async () => {
    if (certFiles.length === 0) {
      toast("请先选择证书图片", "error");
      return;
    }
    setBusy("cert");
    try {
      const urls: string[] = [];
      for (const f of certFiles) {
        urls.push(await uploadPhotoWithRetry(f, "verification", 3));
      }
      await post({ certificates: urls }, "技能证书已提交");
      setCertFiles([]);
    } catch {
      toast("证书上传失败，请重试", "error");
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    { key: "phone", label: "手机验证", done: stage.phoneDone },
    { key: "id", label: "身份证件", done: stage.idDone },
    { key: "face", label: "人脸采集", done: stage.faceDone },
  ];

  return (
    <div className="space-y-4">
      {/* 进度头：三步缺哪补哪 */}
      <div className="flex items-center gap-2" data-testid="verify-progress">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <span
              data-testid={`verify-step-${s.key}`}
              data-done={s.done}
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                s.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="text-xs font-bold text-slate-700">{s.label}</span>
            {i < steps.length - 1 && <span className="h-0.5 flex-1 rounded bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* 第一步：手机（SMS 登录即验证；本页只读态＋跳转） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="verify-card-phone">
        <h3 className="text-sm font-bold text-slate-900">
          第一步 · 手机验证 {stage.phoneDone && <span className="text-emerald-500">✓</span>}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {stage.phoneDone ? "手机号已验证通过" : "用短信验证码登录一次即完成验证"}
        </p>
        {!stage.phoneDone && (
          <Button onClick={() => router.push("/login")} className="mt-3 rounded-xl" data-testid="verify-phone-go">
            去验证手机 <ChevronRight className="ml-1 size-4" />
          </Button>
        )}
      </section>

      {/* 第二步：身份证件 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="verify-card-id">
        <h3 className="text-sm font-bold text-slate-900">
          第二步 · 身份证件 {stage.idDone && <span className="text-emerald-500">✓</span>}
        </h3>
        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="与身份证一致的姓名"
            aria-label="真实姓名"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="18位公民身份证号码"
            maxLength={18}
            aria-label="身份证号"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Button onClick={submitId} disabled={busy !== null} className="w-full rounded-xl" data-testid="verify-id-submit">
            {busy === "id" ? (<><Loader2 className="mr-2 size-4 animate-spin" />核验中...</>) : stage.idDone ? "重新核验身份证件" : "提交身份证件核验"}
          </Button>
        </div>
      </section>

      {/* 第三步：人脸采集 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="verify-card-face">
        <h3 className="text-sm font-bold text-slate-900">
          第三步 · 人脸采集 {stage.faceDone && <span className="text-emerald-500">✓</span>}
        </h3>
        <p className="mt-1 text-xs text-slate-500">正对镜头光线充足处拍摄（活体厂商接入前为照片采集＋自动核验）</p>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="outline" onClick={() => faceInputRef.current?.click()} className="rounded-xl" data-testid="verify-face-pick">
            <Upload className="mr-1 size-4" /> {faceFile ? faceFile.name : "选择正脸照片"}
          </Button>
          <input
            ref={faceInputRef}
            type="file"
            accept="image/*"
            aria-label="选择人脸照片文件"
            onChange={(e) => setFaceFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {faceFile && (
            <button type="button" onClick={() => setFaceFile(null)} aria-label="移除人脸照片" className="text-slate-400">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button onClick={submitFace} disabled={busy !== null} className="mt-3 w-full rounded-xl" data-testid="verify-face-submit">
          {busy === "face" ? (<><Loader2 className="mr-2 size-4 animate-spin" />核验中...</>) : stage.faceDone ? "重新核验人脸" : "提交人脸核验"}
        </Button>
      </section>

      {/* 加分项：技能证书（可选，旧单表能力保留） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="verify-card-cert">
        <h3 className="text-sm font-bold text-slate-900">加分项 · 技能证书（可选）</h3>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="outline" onClick={() => certInputRef.current?.click()} className="rounded-xl" data-testid="verify-cert-pick">
            <Upload className="mr-1 size-4" /> 已选 {certFiles.length} 张
          </Button>
          <input
            ref={certInputRef}
            type="file"
            accept="image/*"
            multiple
            aria-label="选择证书图片文件"
            onChange={(e) => setCertFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
        </div>
        <Button onClick={submitCerts} disabled={busy !== null} className="mt-3 w-full rounded-xl" data-testid="verify-cert-submit">
          {busy === "cert" ? (<><Loader2 className="mr-2 size-4 animate-spin" />上传中...</>) : "提交技能证书"}
        </Button>
      </section>

      {stage.approved && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-600" data-testid="verify-all-done">
          <ShieldCheck className="size-4" /> 三件齐活，系统已自动通过
        </p>
      )}
    </div>
  );
}
