import React from "react"
import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase-client"
import ClientTrackingClient from "./ClientTrackingClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientOrderPage({ params }: PageProps) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: demand, error } = await supabase
    .from("demands")
    .select("id, title, price, status, certificate_images, client_name")
    .eq("id", id)
    .single()

  if (error || !demand) return notFound()

  return <ClientTrackingClient initialData={demand} />
}
