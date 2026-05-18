"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Home,
  ChevronsLeft,
  MoreHorizontal,
  LogOut,
  Clock,
} from "lucide-react";
import clsx from "clsx";

interface RecentProject {
  id: string;
  name: string;
  status: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(({ projects }) => setRecent((projects || []).slice(0, 6)))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = () => {
    document.cookie = "auth=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  };

  const statusDot: Record<string, string> = {
    complete: "bg-[#4dab9a]",
    running: "bg-[#c28b2d]",
    draft: "bg-[#c4c4c1]",
  };

  return (
    <aside className="w-[260px] h-screen bg-[#f7f7f5] flex flex-col shrink-0 fixed left-0 top-0 z-10 border-r border-[#ebebea]">
      {/* Workspace header */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#ececea] cursor-pointer"
        >
          <div className="w-[22px] h-[22px] rounded-[4px] bg-gradient-to-br from-[#2383e2] to-[#1a73d4] flex items-center justify-center shrink-0 shadow-sm">
            <Search className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[14px] font-semibold text-[#37352f] flex-1 text-left truncate">
            Lead Finder
          </span>
          <MoreHorizontal className="w-3.5 h-3.5 text-[#9b9a97]" />
        </button>

        {menuOpen && (
          <div className="absolute top-full left-2 right-2 mt-1 bg-white rounded-md shadow-lg border border-[#ebebea] py-1 z-20 animate-fade-in">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#37352f] hover:bg-[#f1f1ef]"
            >
              <LogOut className="w-3.5 h-3.5 text-[#9b9a97]" />
              Log out
            </button>
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav className="px-2 pt-1 pb-2">
        <SidebarLink href="/" icon={Home} label="Dashboard" active={pathname === "/"} />
        <SidebarLink
          href="/search/new"
          icon={Plus}
          label="New Search"
          active={pathname === "/search/new"}
        />
      </nav>

      {/* Recent projects */}
      {recent.length > 0 && (
        <div className="px-2 pt-2 flex-1 overflow-y-auto">
          <div className="flex items-center gap-1 px-2 py-1 mb-0.5">
            <Clock className="w-3 h-3 text-[#9b9a97]" />
            <p className="text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">
              Recent
            </p>
          </div>
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/search/${p.id}`}
              className={clsx(
                "flex items-center gap-2 px-2 py-[5px] rounded-[3px] text-[14px] group transition-colors",
                pathname === `/search/${p.id}`
                  ? "bg-[#e5e5e3] text-[#37352f]"
                  : "text-[#37352f] hover:bg-[#ececea]"
              )}
            >
              <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", statusDot[p.status] || statusDot.draft)} />
              <span className="truncate flex-1">{p.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[#ebebea] flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="p-1 rounded hover:bg-[#ececea] text-[#9b9a97]"
          title="Collapse"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <p className="text-[11px] text-[#9b9a97]">v1.0</p>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2 px-2 py-[5px] rounded-[3px] text-[14px] group transition-colors",
        active ? "bg-[#e5e5e3] text-[#37352f] font-medium" : "text-[#37352f] hover:bg-[#ececea]"
      )}
    >
      <Icon className="w-[15px] h-[15px] text-[#787774] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
