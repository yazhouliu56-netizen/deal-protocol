import DashboardClient from "./DashboardClient"
import ConversationalBiView from "@/components/admin/ConversationalBiView"
import ResilienceControlPanel from "@/components/admin/ResilienceControlPanel"

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardClient />
      <ConversationalBiView />
      <ResilienceControlPanel />
    </div>
  )
}