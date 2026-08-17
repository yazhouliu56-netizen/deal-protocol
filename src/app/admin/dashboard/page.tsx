import DashboardClient from "./DashboardClient"
import ConversationalBiView from "@/components/admin/ConversationalBiView"

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardClient />
      <ConversationalBiView />
    </div>
  )
}