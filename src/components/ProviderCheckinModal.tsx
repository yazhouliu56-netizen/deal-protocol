"use client";

import React, { useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { X, MapPin, Camera, Shield, Loader2 } from "lucide-react";
import { calculateClientFileHash, calculateHaversineDistance } from "@/lib/client-crypto";

const ACTION_MAP: Record<string, string> = {
  ARRIVED: "provider_arrive",
  IN_PROGRESS: "start_service",
  DONE: "request_complete",
};

interface ProviderCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  targetStage: "ARRIVED" | "IN_PROGRESS" | "DONE";
  targetCoordinates?: [number, number];
  onSuccess: () => void;
}

export default function ProviderCheckinModal({
  isOpen,
  onClose,
  contractId,
  targetStage,
  targetCoordinates,
  onSuccess,
}: ProviderCheckinModalProps) {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [gpsLoaded, setGpsLoaded] = useState(false);
  const [photoHash, setPhotoHash] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleGetGps = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("浏览器不支持地理定位");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);

        if (targetCoordinates) {
          const d = calculateHaversineDistance(
            [lng, lat],
            [targetCoordinates[0], targetCoordinates[1]],
          );
          setDistance(d);
        }

        setGpsLoaded(true);
      },
      () => {
        setGeoError("获取 GPS 位置失败，请确保已开启定位权限");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hash = await calculateClientFileHash(file);
    setPhotoHash(hash);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!latitude || !longitude) {
      toast.error("请先获取现场 GPS 坐标");
      return;
    }

    if (!photoHash) {
      toast.error("请选择现场照片");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("正在提交现场打卡...");

    try {
      const res = await fetch(`/api/orders/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: ACTION_MAP[targetStage],
          latitude,
          longitude,
          photoUrl: photoPreviewUrl,
          photoHash,
          role: "PROVIDER",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "打卡提交失败");

      toast.success("现场打卡成功", { id: toastId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`打卡失败: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const distanceOk = distance !== null && distance < 200;
  const stageLabel: Record<string, string> = {
    ARRIVED: "到达现场",
    IN_PROGRESS: "开始服务",
    DONE: "完成服务",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
          aria-label="关闭打卡"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="text-lg font-bold text-zinc-100">
            📍 {stageLabel[targetStage]}打卡
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            请在现场完成打卡，系统将记录 GPS 坐标与照片哈希存证
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <MapPin className="w-4 h-4 text-emerald-400" />
              现场 GPS 定位
            </div>

            {!gpsLoaded ? (
              <button
                onClick={handleGetGps}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {geoError ? (
                  <span className="text-red-300">{geoError} — 重试</span>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    获取现场 GPS
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-mono">
                  {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
                </div>
                {distance !== null && (
                  <div
                    className={`flex items-center gap-1.5 text-sm ${
                      distanceOk ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    <span>{distanceOk ? "📍" : "⚠️"}</span>
                    <span>
                      {distanceOk
                        ? `坐标核验通过 (距现场 ${distance} 米)`
                        : `距现场较远 (${distance} 米)`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Camera className="w-4 h-4 text-emerald-400" />
              现场照片存证
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {!photoHash ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                拍摄或选择现场照片
              </button>
            ) : (
              <div className="space-y-2">
                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
                    alt="现场照片"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
                <div className="flex items-start gap-2 p-2.5 bg-zinc-950/50 rounded-lg border border-zinc-700">
                  <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs font-mono text-emerald-300 break-all leading-relaxed">
                    司法摘要: {photoHash}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!gpsLoaded || !photoHash || isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中
              </>
            ) : (
              "确认打卡"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
