import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-[260px] flex-1 min-h-screen bg-white">
        {children}
      </main>
    </div>
  );
}
