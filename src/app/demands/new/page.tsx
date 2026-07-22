"use client"

import dynamic from "next/dynamic"

const SplitDemandView = dynamic(
  () => import("@/components/SplitDemandView"),
  { ssr: false },
)

export default function NewDemandPage() {
  return <SplitDemandView />
}
