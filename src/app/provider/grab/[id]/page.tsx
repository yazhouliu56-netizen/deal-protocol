import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * 根路由重定向（C16 收编）：/provider/grab/[id] → /dp/provider/grab/[id]
 * GrabConsole 竞抢动效已平移至协议专区，本页保留重定向。
 */
export default async function GrabPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/dp/provider/grab/${id}`)
}
