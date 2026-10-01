"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import { CATEGORIES, isBlockedChain } from "@/lib/constants";
import citySubareas from "@/data/uk-city-subareas.json";

const cityMap = citySubareas as Record<string, string[]>;
const AREAS = Object.keys(cityMap).sort();

// A sub-area is addressed by its parent area + its own name, so towns that share
// a name across areas never collide. NUL is used as the separator since it can't
// appear in an area or town name.
const SEP = "\u0000";
const keyOf = (area: string, subarea: string) => `${area}${SEP}${subarea}`;

function formatAreas(areas: string[]): string {
  if (areas.length === 0) return "";
  if (areas.length === 1) return areas[0];
  if (areas.length === 2) return `${areas[0]} & ${areas[1]}`;
  if (areas.length === 3) return `${areas[0]}, ${areas[1]} & ${areas[2]}`;
  return `${areas[0]}, ${areas[1]} & ${areas.length - 2} more`;
}

// fetch that gives up after `ms` so one hung request can't freeze the whole run.
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Flat multi-select used for the top-level areas (counties / cities).
function AreaDropdown({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: string[];
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

  const label =
    selected.size === 0
      ? "Select areas..."
      : selected.size === options.length
      ? `All ${options.length} areas`
      : selected.size === 1
      ? [...selected][0]
      : `${selected.size} areas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
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
            <button onClick={() => onChange(new Set(options))} className="text-[12px] font-medium text-[#2383e2] hover:underline">Select all</button>
            <span className="text-[#ebebea]">·</span>
            <button onClick={() => onChange(new Set())} className="text-[12px] font-medium text-[#787774] hover:text-[#37352f]">Clear</button>
            <span className="ml-auto text-[11px] text-[#9b9a97] tabular-nums">
              {selected.size}/{options.length}
            </span>
          </div>
          {options.map((area) => (
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

// Grouped multi-select for sub-areas: when more than one area is picked the
// towns are shown under their area heading. Selection is keyed by area+town.
function SubareaDropdown({
  groups,
  selectedKeys,
  onChange,
  disabled,
}: {
  groups: { area: string; subareas: string[] }[];
  selectedKeys: Set<string>;
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

  const allKeys = groups.flatMap((g) => g.subareas.map((s) => keyOf(g.area, s)));
  const total = allKeys.length;
  const showHeaders = groups.length > 1;

  const toggle = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const label =
    total === 0
      ? "Select an area first"
      : selectedKeys.size === 0
      ? "Select sub-areas..."
      : selectedKeys.size === total
      ? `All ${total} sub-areas`
      : `${selectedKeys.size} of ${total} sub-areas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || total === 0}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-[#ebebea] rounded-md px-3 py-2 text-[13px] bg-white text-left hover:border-[#d9d9d7] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15 transition-all h-[38px]"
      >
        <span className={clsx("truncate", selectedKeys.size === 0 ? "text-[#9b9a97]" : "text-[#37352f]")}>
          {label}
        </span>
        <ChevronDown className={clsx("w-3.5 h-3.5 text-[#9b9a97] transition-transform shrink-0 ml-2", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-[#ebebea] rounded-lg notion-shadow py-1 max-h-80 overflow-y-auto animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ebebea] sticky top-0 bg-white">
            <button onClick={() => onChange(new Set(allKeys))} className="text-[12px] font-medium text-[#2383e2] hover:underline">Select all</button>
            <span className="text-[#ebebea]">·</span>
            <button onClick={() => onChange(new Set())} className="text-[12px] font-medium text-[#787774] hover:text-[#37352f]">Clear</button>
            <span className="ml-auto text-[11px] text-[#9b9a97] tabular-nums">
              {selectedKeys.size}/{total}
            </span>
          </div>
          {groups.map((g) => (
            <div key={g.area}>
              {showHeaders && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[#9b9a97] uppercase tracking-wider">
                  {g.area}
                </div>
              )}
              {g.subareas.map((sub) => {
                const key = keyOf(g.area, sub);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-[#37352f] hover:bg-[#f1f1ef] text-left"
                  >
                    <div className={clsx(
                      "w-[15px] h-[15px] rounded-[3px] border flex items-center justify-center shrink-0 transition-colors",
                      selectedKeys.has(key) ? "bg-[#2383e2] border-[#2383e2]" : "border-[#d9d9d7]"
                    )}>
                      {selectedKeys.has(key) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    {sub}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchWizard() {
  const router = useRouter();
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({
    current: "",
    done: 0,
    total: 0,
    found: 0,
    skipped: 0,
    failed: [] as string[],
    errorMsg: "",
  });

  // When the set of areas changes, keep existing sub-area choices for areas that
  // were already selected, and select every town for newly-added areas.
  const handleAreasChange = useCallback((nextAreas: Set<string>) => {
    setSelectedKeys((prev) => {
      const next = new Set<string>();
      for (const area of nextAreas) {
        const wasSelected = selectedAreas.has(area);
        for (const sub of cityMap[area] || []) {
          const k = keyOf(area, sub);
          if (!wasSelected || prev.has(k)) next.add(k);
        }
      }
      return next;
    });
    setSelectedAreas(nextAreas);
  }, [selectedAreas]);

  // Groups shown in the sub-area dropdown, in sorted area order.
  const groups = AREAS.filter((a) => selectedAreas.has(a)).map((area) => ({
    area,
    subareas: cityMap[area] || [],
  }));

  const canStart = selectedAreas.size > 0 && selectedKeys.size > 0 && category && !isRunning;

  const handleStart = useCallback(async () => {
    if (!canStart) return;

    // Expand the selection into (area, sub-area) pairs to search, in a stable order.
    const pairs: { area: string; sub: string }[] = [];
    for (const area of AREAS.filter((a) => selectedAreas.has(a))) {
      for (const sub of cityMap[area] || []) {
        if (selectedKeys.has(keyOf(area, sub))) pairs.push({ area, sub });
      }
    }
    const areasInUse = [...new Set(pairs.map((p) => p.area))];
    const areaLabel = formatAreas(areasInUse);

    setIsRunning(true);
    setProgress({ current: "", done: 0, total: pairs.length, found: 0, skipped: 0, failed: [], errorMsg: "" });

    let projectId: string | null = null;
    try {
      // Create project
      const projectRes = await fetchWithTimeout("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${areaLabel} — ${category}`,
          city: areaLabel,
          category,
          subareas: pairs.map((p) => p.sub),
        }),
      }, 20000);
      const { project } = await projectRes.json();
      if (!project?.id) throw new Error("Could not create the project");
      projectId = project.id;

      await fetchWithTimeout(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running" }),
      }, 15000).catch(() => {});

      const seenPlaceIds = new Set<string>();
      const seenDomains = new Set<string>();
      // Leads collected but not yet saved to the server. Cleared after each
      // successful save so we never re-send the whole growing list (which got
      // slower every round and could time out on big multi-area runs).
      let pendingLeads: unknown[] = [];
      let found = 0;
      let skipped = 0;
      const failed: string[] = [];

      for (let i = 0; i < pairs.length; i++) {
        const { area, sub } = pairs[i];
        // Label the progress with the area when searching across several of them.
        const current = areasInUse.length > 1 ? `${sub}, ${area}` : sub;
        setProgress((p) => ({ ...p, current, done: i }));

        try {
          const placesRes = await fetchWithTimeout("/api/search-places", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subarea: sub, city: area, category }),
          }, 30000);
          const placesData = await placesRes.json();
          if (!placesRes.ok) throw new Error(placesData.error);

          for (const place of placesData.results || []) {
            if (seenPlaceIds.has(place.placeId)) { skipped++; continue; }
            seenPlaceIds.add(place.placeId);
            if (!place.website) { skipped++; continue; }
            if (isBlockedChain(place.name)) { skipped++; continue; }

            // A single slow/broken site must not stall the whole run.
            try {
              await new Promise((r) => setTimeout(r, 200));
              const enrichRes = await fetchWithTimeout("/api/enrich-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ website: place.website }),
              }, 15000);
              const enrichData = await enrichRes.json();
              if (!enrichData.domain) { skipped++; continue; }
              if (seenDomains.has(enrichData.domain)) { skipped++; continue; }
              seenDomains.add(enrichData.domain);

              pendingLeads.push({
                placeId: place.placeId,
                name: place.name,
                address: place.address,
                domain: enrichData.domain,
                instagram: enrichData.instagram || null,
                facebook: enrichData.facebook || null,
                category,
                subarea: sub,
                city: area,
              });
              found++;
              setProgress((p) => ({ ...p, found, skipped }));
            } catch {
              // Enrichment timed out or failed for this one place — skip it.
              skipped++;
            }
          }
        } catch (err) {
          failed.push(current);
          const msg = err instanceof Error ? err.message : String(err);
          setProgress((p) => ({ ...p, errorMsg: p.errorMsg || msg }));
        }

        // Save only the leads gathered since the last save. On failure, keep
        // them buffered to retry on the next round (the upsert ignores dupes).
        if (pendingLeads.length > 0) {
          try {
            const saveRes = await fetchWithTimeout(`/api/projects/${projectId}/leads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leads: pendingLeads }),
            }, 30000);
            if (saveRes.ok) pendingLeads = [];
          } catch {
            // keep pendingLeads for the next round
          }
        }

        setProgress((p) => ({ ...p, done: i + 1, found, skipped, failed: [...failed] }));
        await new Promise((r) => setTimeout(r, 500));
      }

      // Flush anything still buffered from the final rounds.
      if (pendingLeads.length > 0) {
        await fetchWithTimeout(`/api/projects/${projectId}/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: pendingLeads }),
        }, 30000).catch(() => {});
      }

      toast.success(`Search complete — ${found} leads found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress((p) => ({ ...p, errorMsg: p.errorMsg || msg }));
      toast.error(`Search stopped: ${msg}`);
    } finally {
      // Always mark the project done and release the UI, even if something threw,
      // so a project can't be left stuck on "running".
      if (projectId) {
        await fetchWithTimeout(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "complete" }),
        }, 15000).catch(() => {});
      }
      setIsRunning(false);
      if (projectId) router.push(`/search/${projectId}`);
    }
  }, [canStart, selectedAreas, selectedKeys, category, router]);

  return (
    <div>
      {/* Form card */}
      <div className="border border-[#ebebea] rounded-xl bg-white p-5 mb-4 notion-shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <Field label="Areas">
            <AreaDropdown
              options={AREAS}
              selected={selectedAreas}
              onChange={handleAreasChange}
              disabled={isRunning}
            />
          </Field>

          <Field label="Sub-areas">
            <SubareaDropdown
              groups={groups}
              selectedKeys={selectedKeys}
              onChange={setSelectedKeys}
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

          {progress.errorMsg && (
            <div className="rounded-lg border border-[#f5c2c2] bg-[#fdeaea] px-3 py-2.5">
              <p className="text-[11px] font-semibold text-[#c0392b] uppercase tracking-wider mb-1">
                Search error
              </p>
              <p className="text-[12px] text-[#7a2a2a] break-words font-mono leading-snug">
                {progress.errorMsg}
              </p>
            </div>
          )}
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
