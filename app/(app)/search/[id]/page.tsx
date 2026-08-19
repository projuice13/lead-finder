"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin, Tag, Users, Inbox } from "lucide-react";
import clsx from "clsx";
import LeadTable from "@/components/LeadTable";
import PageHeader from "@/components/PageHeader";

interface Project {
  id: string;
  name: string;
  city: string;
  category: string;
  status: string;
  createdAt: string;
  _count: { leads: number };
}

interface Lead {
  id: string;
  name: string;
  address: string;
  domain: string;
  email: string | null;
  emails: string | null;
  instagram: string | null;
  facebook: string | null;
  category: string;
  subarea: string;
  city: string;
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

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then(({ project }) => setProject(project))
      .catch(() => router.push("/"));
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${id}/leads?page=${page}`)
      .then((r) => r.json())
      .then(({ leads, total, pages }) => {
        setLeads(leads || []);
        setTotal(total || 0);
        setPages(pages || 1);
      })
      .finally(() => setLoading(false));
  }, [id, page]);

  if (!project) {
    return (
      <div className="px-8 pt-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#f1f1ef] rounded w-64" />
          <div className="h-4 bg-[#f1f1ef] rounded w-40" />
        </div>
      </div>
    );
  }

  const status = statusConfig[project.status] || statusConfig.draft;
  const emoji = categoryEmoji[project.category] || "🔎";

  return (
    <div className="px-8">
      <PageHeader
        emoji={emoji}
        title={project.name}
        breadcrumbs={[{ label: "Projects", href: "/" }, { label: project.name }]}
      />

      {/* Meta row */}
      <div className="flex items-center gap-5 text-[13px] text-[#787774] mb-8 pb-4 border-b border-[#ebebea]">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {project.city}
        </span>
        <span className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          {project.category}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {total} {total === 1 ? "lead" : "leads"}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <div className={clsx("w-1.5 h-1.5 rounded-full", status.dot)} />
          <span className={clsx("font-medium", status.text)}>{status.label}</span>
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-[#f1f1ef] rounded" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[#f1f1ef] flex items-center justify-center mb-4">
            <Inbox className="w-5 h-5 text-[#9b9a97]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[15px] font-semibold text-[#37352f] mb-1">No leads yet</h2>
          <p className="text-[13px] text-[#787774]">
            {project.status === "running"
              ? "Search is still running — check back soon."
              : "No leads were found with a website domain."}
          </p>
        </div>
      ) : (
        <LeadTable
          leads={leads}
          projectName={project.name}
          total={total}
          page={page}
          pages={pages}
          onPageChange={setPage}
          onLeadUpdate={(id, patch) =>
            setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
          }
          onLeadsDelete={(ids) => {
            const idSet = new Set(ids);
            setLeads((prev) => prev.filter((l) => !idSet.has(l.id)));
            setTotal((prev) => Math.max(0, prev - ids.length));
          }}
        />
      )}
    </div>
  );
}
