'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, ShieldCheck } from 'lucide-react'
import { createSignalingChannel, sendOffer, sendIceCandidate, logWebRTCCallEvidence } from '@/lib/webrtc-call'

interface WebRTCCallRoomProps {
  contractId: string
  localUserId: string
  peerUserId: string
  onEnd?: () => void
}

export default function WebRTCCallRoom({
  contractId,
  localUserId,
  peerUserId,
  onEnd,
}: WebRTCCallRoomProps) {
  const [audioMuted, setAudioMuted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [callActive, setCallActive] = useState(false)
  const [logging, setLogging] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof createSignalingChannel> | null>(null)
  const startTimeRef = useRef<number>(0)

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ]

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection({ iceServers })
      pcRef.current = pc

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          sendIceCandidate(channelRef.current, event.candidate, localUserId, peerUserId)
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'closed'
        ) {
          endCall()
        }
      }

      const channel = createSignalingChannel(contractId, pc, localUserId)
      channelRef.current = channel

      setTimeout(async () => {
        await sendOffer(channel, pc, localUserId, peerUserId)
      }, 500)

      setCallActive(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } catch (err) {
      console.error('Failed to start WebRTC call:', err)
    }
  }, [contractId, localUserId, peerUserId, iceServers])

  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)

    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }

    setCallActive(false)
    setElapsed(0)

    return duration
  }, [])

  const handleHangup = async () => {
    const duration = await endCall()

    setLogging(true)
    try {
      await logWebRTCCallEvidence(contractId, localUserId, peerUserId, duration)
    } catch (err) {
      console.error('Failed to log WebRTC evidence:', err)
    } finally {
      setLogging(false)
    }

    onEnd?.()
  }

  useEffect(() => {
    startCall()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (channelRef.current) channelRef.current.unsubscribe()
      if (pcRef.current) pcRef.current.close()
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [startCall])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl bg-zinc-950 shadow-xl">
      {/* Remote video (full background) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="aspect-[4/3] w-full bg-zinc-900 object-cover"
      />

      {/* Local video (PiP, bottom-right) */}
      <div className="absolute bottom-20 right-4 z-10 h-28 w-20 overflow-hidden rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      </div>

      {/* Timer overlay */}
      {callActive && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
          <Clock className="size-3.5" />
          {formatTime(elapsed)}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-6 pt-12">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setAudioMuted((m) => !m)}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              audioMuted
                ? 'bg-rose-600 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            aria-label={audioMuted ? '取消静音' : '静音'}
          >
            {audioMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>

          <button
            onClick={handleHangup}
            disabled={logging}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition-all hover:bg-rose-700 active:scale-[0.95] disabled:opacity-50"
            aria-label="挂断"
          >
            <PhoneOff className="size-6" />
          </button>

          <button
            onClick={() => setVideoMuted((m) => !m)}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              videoMuted
                ? 'bg-rose-600 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            aria-label={videoMuted ? '开启摄像头' : '关闭摄像头'}
          >
            {videoMuted ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        </div>

        {logging && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/70">
            <ShieldCheck className="size-3.5" />
            正在上传看场存证...
          </div>
        )}
      </div>
    </div>
  )
}
