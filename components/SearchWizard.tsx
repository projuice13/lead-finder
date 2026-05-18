"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import { CATEGORIES } from "@/lib/constants";
import citySubareas from "@/data/uk-city-subareas.json";

const cityMap = citySubareas as Record<string, string[]>;
const CITIES = Object.keys(cityMap).sort();

// Custom multi-select dropdown for sub-areas
function SubareaDropdown({
  subareas,
  selected,
  onChange,
  disabled,
}: {
  subareas: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (area: string) => {
    const next = new Set(selected);
    if (next.has(area)) next.delete(area);
    else next.add(area);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(subareas));
  const clearAll = () => onChange(new Set());

  const label =
    subareas.length === 0
      ? "Select a city first"
      : selected.size === 0
      ? "Select sub-areas..."
      : selected.size === subareas.length
      ? `All ${subareas.length} areas`
      : `${selected.size} of ${subareas.length} areas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || subareas.length === 0}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-[#ebebea] rounded-md px-3 py-2 text-[13px] bg-white text-left hover:border-[#d9d9d7] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15 transition-all h-[38px]"
      >
        <span className={clsx("truncate", selected.size === 0 ? "text-[#9b9a97]" : "text-[#37352f]")}>
          {label}
        </span>
        <ChevronDown className={clsx("w-3.5 h-3.5 text-[#9b9a97] transition-transform shrink-0 ml-2", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-[#ebebea] rounded-lg notion-shadow py-1 max-h-80 overflow-y-auto animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ebebea] sticky top-0 bg-white">
            <button onClick={selectAll} className="text-[12px] font-medium text-[#2383e2] hover:underline">Select all</button>
            <span className="text-[#ebebea]">·</span>
            <button onClick={clearAll} className="text-[12px] font-medium text-[#787774] hover:text-[#37352f]">Clear</button>
            <span className="ml-auto text-[11px] text-[#9b9a97] tabular-nums">
              {selected.size}/{subareas.length}
            </span>
          </div>
          {subareas.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#37352f] hover:bg-[#f1f1ef] text-left"
            >
              <div className={clsx(
                "w-[15px] h-[15px] rounded-[3px] border flex items-center justify-center shrink-0 transition-colors",
                selected.has(area) ? "bg-[#2383e2] border-[#2383e2]" : "border-[#d9d9d7]"
              )}>
                {selected.has(area) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              {area}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchWizard() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [subareas, setSubareas] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({
    current: "",
    done: 0,
    total: 0,
    found: 0,
    skipped: 0,
    failed: [] as string[],
  });

  const handleCityChange = useCallback((c: string) => {
    setCity(c);
    const areas = cityMap[c] || [];
    setSubareas(areas);
    setSelected(new Set(areas));
  }, []);

  const canStart = city && selected.size > 0 && category && !isRunning;

  const handleStart = useCallback(async () => {
    if (!canStart) return;
    const selectedAreas = subareas.filter((a) => selected.has(a));

    setIsRunning(true);
    setProgress({ current: "", done: 0, total: selectedAreas.length, found: 0, skipped: 0, failed: [] });

    // Create project
    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${city} — ${category}`,
        city,
        category,
        subareas: selectedAreas,
      }),
    });
    const { project } = await projectRes.json();

    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });

    const seenPlaceIds = new Set<string>();
    const allLeads: unknown[] = [];
    let found = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (let i = 0; i < selectedAreas.length; i++) {
      const area = selectedAreas[i];
      setProgress((p) => ({ ...p, current: area, done: i }));

      try {
        const placesRes = await fetch("/api/search-places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subarea: area, city, category }),
        });
        const placesData = await placesRes.json();
        if (!placesRes.ok) throw new Error(placesData.error);

        for (const place of placesData.results || []) {
          if (seenPlaceIds.has(place.placeId)) { skipped++; continue; }
          seenPlaceIds.add(place.placeId);
          if (!place.website) { skipped++; continue; }

          await new Promise((r) => setTimeout(r, 200));
          const enrichRes = await fetch("/api/enrich-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ website: place.website }),
          });
          const enrichData = await enrichRes.json();
          if (!enrichData.domain) { skipped++; continue; }

          allLeads.push({
            placeId: place.placeId,
            name: place.name,
            address: place.address,
            domain: enrichData.domain,
            instagram: enrichData.instagram || null,
            facebook: enrichData.facebook || null,
            category,
            subarea: area,
            city,
          });
          found++;
          setProgress((p) => ({ ...p, found, skipped }));
        }
      } catch {
        failed.push(area);
      }

      // Save batch after each area
      if (allLeads.length > 0) {
        await fetch(`/api/projects/${project.id}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: allLeads }),
        });
      }

      setProgress((p) => ({ ...p, done: i + 1, found, skipped, failed: [...failed] }));
      await new Promise((r) => setTimeout(r, 500));
    }

    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete" }),
    });

    toast.success(`Search complete — ${found} leads found`);
    router.push(`/search/${project.id}`);
  }, [canStart, subareas, selected, city, category, router]);

  return (
    <div>
      {/* Form card */}
      <div className="border border-[#ebebea] rounded-xl bg-white p-5 mb-4 notion-shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <Field label="City">
            <select
              className="w-full border border-[#ebebea] rounded-md px-3 py-2 text-[13px] text-[#37352f] bg-white hover:border-[#d9d9d7] focus:outline-none focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15 transition-all disabled:opacity-50"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Select city...</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Sub-areas">
            <SubareaDropdown
              subareas={subareas}
              selected={selected}
              onChange={setSelected}
              disabled={isRunning}
            />
          </Field>

          <Field label="Category">
            <select
              className="w-full border border-[#ebebea] rounded-md px-3 py-2 text-[13px] text-[#37352f] bg-white hover:border-[#d9d9d7] focus:outline-none focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15 transition-all disabled:opacity-50"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="flex items-center justify-center gap-2 bg-[#2383e2] text-white rounded-md text-[13px] font-medium px-4 py-2 hover:bg-[#1a73d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm h-[38px]"
          >
            {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isRunning ? "Running" : "Start"}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="border border-[#ebebea] rounded-xl p-5 bg-white space-y-5 animate-fade-in notion-shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-[#37352f] font-medium truncate flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2383e2]" />
                {progress.current || "Preparing..."}
              </span>
              <span className="text-[12px] text-[#9b9a97] shrink-0 ml-2 tabular-nums">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 bg-[#f1f1ef] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2383e2] to-[#4a9eff] transition-all duration-500 ease-out"
                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <Stat value={progress.found} label="Leads found" color="#4dab9a" />
            <Stat value={progress.skipped} label="Skipped" color="#9b9a97" />
            <Stat value={progress.failed.length} label="Failed" color="#eb5757" />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#787774] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-[#fbfbfa] border border-[#f1f1ef] rounded-lg p-3">
      <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      <p className="text-[12px] text-[#787774] mt-1.5">{label}</p>
    </div>
  );
}
