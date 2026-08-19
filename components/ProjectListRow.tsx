"use client";

import { useRouter } from "next/navigation";
import { Trash2, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

interface Project {
  id: string;
  name: string;
  city: string;
  category: string;
  status: string;
  createdAt: string;
  _count: { leads: number };
}

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  draft: { label: "Draft", dot: "bg-[#c4c4c1]", text: "text-[#787774]" },
  running: { label: "Running", dot: "bg-[#c28b2d]", text: "text-[#c28b2d]" },
  complete: { label: "Complete", dot: "bg-[#4dab9a]", text: "text-[#4dab9a]" },
};

const categoryEmoji: Record<string, string> = {
  "Cafes & Coffee Shops": "☕",
  "Gyms & Fitness Centres": "💪",
  "Padel Courts": "🎾",
  "Tennis & Squash Courts": "🎾",
  "Farm Shops": "🌾",
  "Garden Centres": "🌱",
  "Golf Clubs": "⛳",
  "Mobile Catering & Food Trucks": "🚚",
  "Dessert Parlours": "🍨",
  "Holiday & Caravan Parks": "🏕️",
  "Spa's & Health Centres": "💆",
  "Bakeries": "🥖",
  "Restaurants": "🍽️",
  "Plumbers": "🔧",
  "Electricians": "⚡",
  "Carpenters & Joiners": "🪚",
  "Cleaning Companies": "🧽",
  "Accountants": "📊",
  "Lawyers": "⚖️",
};

export default function ProjectListRow({
  project,
  onDeleted,
  selected,
  onToggleSelect,
  selecting,
}: {
  project: Project;
  onDeleted: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selecting?: boolean;
}) {
  const router = useRouter();
  const status = statusConfig[project.status] || statusConfig.draft;
  const emoji = categoryEmoji[project.category] || "🔎";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    onDeleted(project.id);
  };

  return (
    <div
      onClick={() => selecting ? onToggleSelect?.(project.id) : router.push(`/search/${project.id}`)}
      className={clsx(
        "grid items-center gap-3 px-3 py-2 border-b border-[#f1f1ef] last:border-b-0 cursor-pointer group transition-colors",
        "grid-cols-[28px_1fr_140px_180px_100px_120px_40px]",
        selected ? "bg-[#e8f0fe]" : "hover:bg-[#fbfbfa]"
      )}
    >
      <div
        className={clsx(
          "transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(project.id)}
          className="rounded-[3px] border-[#d9d9d7] text-[#2383e2] focus:ring-[#2383e2] cursor-pointer"
        />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[15px] shrink-0">{emoji}</span>
        <span className="text-[14px] font-medium text-[#37352f] truncate">
          {project.name}
        </span>
      </div>
      <div className="text-[13px] text-[#787774] truncate">{project.city}</div>
      <div className="text-[13px] text-[#787774] truncate">{project.category}</div>
      <div className="text-[13px] text-[#37352f]">{project._count.leads}</div>
      <div className="flex items-center gap-1.5">
        <div className={clsx("w-1.5 h-1.5 rounded-full", status.dot)} />
        <span className={clsx("text-[12px] font-medium", status.text)}>
          {status.label}
        </span>
      </div>
      <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#f1f1ef] text-[#9b9a97] transition-opacity"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-md border border-[#ebebea] py-1 shadow-lg z-10 min-w-[140px] animate-fade-in">
            <button
              onClick={handleDelete}
              className={clsx(
                "w-full flex items-center gap-2 px-3 py-1.5 text-[13px]",
                confirming
                  ? "bg-[#fdeaea] text-[#eb5757]"
                  : "text-[#eb5757] hover:bg-[#fdeaea]"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirming ? "Click again to delete" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
