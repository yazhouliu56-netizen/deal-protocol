import FactoryConsole from "@/components/admin/FactoryConsole";

export default async function AdminFactoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold">工厂控制台 · 开品类</h1>
      <FactoryConsole />
    </div>
  );
}
