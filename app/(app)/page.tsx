"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, LayoutGrid, List, Search, Download, X, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";
import ProjectCard from "@/components/ProjectCard";
import ProjectListRow from "@/components/ProjectListRow";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

interface Project {
  id: string;
  name: string;
  city: string;
  category: string;
  status: string;
  createdAt: string;
  _count: { leads: number };
}

type View = "grid" | "list";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const selecting = selectedIds.size > 0;

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(({ projects }) => setProjects(projects || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const filtered = useMemo(() => {
    if (!query) return projects;
    const q = query.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [projects, query]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((p) => p.id))
    );
  }, [filtered]);

  const handleBulkExport = useCallback(async (klaviyo = false) => {
    setExporting(true);
    try {
      const res = await fetch("/api/projects/bulk-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), klaviyo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${selectedIds.size}_projects${klaviyo ? "_klaviyo" : "_leads"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [selectedIds]);

  return (
    <div className="max-w-[960px] mx-auto px-16">
      <PageHeader
        emoji="🔎"
        title="Projects"
        subtitle={
          !loading
            ? projects.length > 0
              ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}`
              : "Start by creating a new search"
            : undefined
        }
        actions={
          <Link
            href="/search/new"
            className="flex items-center gap-1.5 bg-[#2383e2] text-white rounded-md text-[13px] font-medium px-2.5 py-1.5 hover:bg-[#1a73d4] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Search
          </Link>
        }
      />

      {/* Toolbar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 mb-4 border-b border-[#ebebea] pb-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#9b9a97] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-[13px] text-[#37352f] placeholder:text-[#9b9a97] pl-8 pr-3 py-1 rounded hover:bg-[#f1f1ef] focus:bg-[#f1f1ef] transition-colors"
            />
          </div>

          <button
            onClick={selecting ? () => setSelectedIds(new Set()) : toggleSelectAll}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors",
              selecting
                ? "border-[#2383e2] text-[#2383e2] bg-[#f0f7ff]"
                : "border-[#ebebea] text-[#787774] hover:bg-[#f1f1ef]"
            )}
          >
            {selecting ? (
              <><X className="w-3 h-3" /> {selectedIds.size} selected</>
            ) : (
              "Select"
            )}
          </button>

          <div className="ml-auto flex items-center gap-0.5 bg-[#f1f1ef] rounded-[5px] p-0.5">
            <button
              onClick={() => setView("grid")}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-[3px] text-[12px]",
                view === "grid" ? "bg-white shadow-sm text-[#37352f]" : "text-[#787774] hover:text-[#37352f]"
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              Gallery
            </button>
            <button
              onClick={() => setView("list")}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 rounded-[3px] text-[12px]",
                view === "list" ? "bg-white shadow-sm text-[#37352f]" : "text-[#787774] hover:text-[#37352f]"
              )}
            >
              <List className="w-3 h-3" />
              List
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="border border-[#ebebea] rounded-lg p-4 animate-pulse space-y-3 bg-white"
            >
              <div className="h-4 bg-[#f1f1ef] rounded w-3/4" />
              <div className="h-3 bg-[#f1f1ef] rounded w-1/2" />
              <div className="h-3 bg-[#f1f1ef] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && projects.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-[#787774]">
          No projects match &ldquo;{query}&rdquo;
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDeleted={handleDeleted}
              selected={selectedIds.has(project.id)}
              onToggleSelect={toggleSelect}
              selecting={selecting}
            />
          ))}
        </div>
      ) : (
        <div className="border border-[#ebebea] rounded-lg overflow-hidden bg-white animate-fade-in">
          <div className="grid grid-cols-[28px_1fr_140px_180px_100px_120px_40px] items-center gap-3 px-3 py-2 border-b border-[#ebebea] bg-[#fbfbfa] text-[11px] font-medium text-[#787774] uppercase tracking-wider">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="rounded-[3px] border-[#d9d9d7] text-[#2383e2] focus:ring-[#2383e2] cursor-pointer"
            />
            <div>Name</div>
            <div>City</div>
            <div>Category</div>
            <div>Leads</div>
            <div>Status</div>
            <div></div>
          </div>
          {filtered.map((project) => (
            <ProjectListRow
              key={project.id}
              project={project}
              onDeleted={handleDeleted}
              selected={selectedIds.has(project.id)}
              onToggleSelect={toggleSelect}
              selecting={selecting}
            />
          ))}
        </div>
      )}

      {/* Floating action bar */}
      {selecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#37352f] rounded-xl px-4 py-2.5 flex items-center gap-4 notion-shadow z-30 animate-fade-in">
          <span className="text-[13px] text-white">
            <span className="font-semibold">{selectedIds.size}</span>
            <span className="text-white/60 ml-1">{selectedIds.size === 1 ? "project" : "projects"} selected</span>
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[13px] text-white/70 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => handleBulkExport(false)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-white/10 text-white text-[13px] font-medium rounded-md px-2.5 py-1 hover:bg-white/20 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <button
            onClick={() => handleBulkExport(true)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-[#2383e2] text-white text-[13px] font-medium rounded-md px-2.5 py-1 hover:bg-[#1a73d4] disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Export for Klaviyo
          </button>
        </div>
      )}
    </div>
  );
}
