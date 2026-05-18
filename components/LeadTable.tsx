"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  Instagram,
  Facebook,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Loader2,
  Check,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

type HunterVerificationStatus =
  | "valid"
  | "invalid"
  | "accept_all"
  | "webmail"
  | "disposable"
  | "unknown"
  | "pending"
  | null;

interface HunterEmailMeta {
  value: string;
  confidence: number | null;
  type: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  verification_status: HunterVerificationStatus;
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

interface LeadTableProps {
  leads: Lead[];
  projectName: string;
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onLeadUpdate?: (id: string, patch: Partial<Lead>) => void;
  onLeadsDelete?: (ids: string[]) => void;
}

type SortKey = keyof Lead;
type SortDir = "asc" | "desc";

export default function LeadTable({
  leads,
  projectName,
  total,
  page,
  pages,
  onPageChange,
  onLeadUpdate,
  onLeadsDelete,
}: LeadTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exporting, setExporting] = useState(false);
  const [hunting, setHunting] = useState(false);
  const [huntProgress, setHuntProgress] = useState({ done: 0, total: 0 });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const areas = useMemo(
    () => Array.from(new Set(leads.map((l) => l.subarea))).sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.domain.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q)
      );
    }
    if (areaFilter) result = result.filter((l) => l.subarea === areaFilter);
    result = [...result].sort((a, b) => {
      const av = (a[sortKey] || "") as string;
      const bv = (b[sortKey] || "") as string;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return result;
  }, [leads, search, areaFilter, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("asc");
      }
      return key;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((l) => l.id));
    });
  }, [filtered]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(
    async (exportAll: boolean, klaviyo = false) => {
      setExporting(true);
      try {
        const toExport = exportAll
          ? filtered
          : filtered.filter((l) => selected.has(l.id));
        const res = await fetch("/api/export-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: toExport, projectName, klaviyo }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Export failed" }));
          throw new Error(err.error || "Export failed");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const suffix = klaviyo ? "klaviyo" : "leads";
        a.download = `${projectName.replace(/[^a-z0-9]/gi, "_")}_${suffix}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(false);
      }
    },
    [filtered, selected, projectName]
  );

  const handleHunter = useCallback(async () => {
    const targets = filtered.filter((l) => selected.has(l.id) && l.domain);
    if (targets.length === 0) {
      toast.error("Select leads with a domain first");
      return;
    }
    setHunting(true);
    setHuntProgress({ done: 0, total: targets.length });
    let verifiedFound = 0;
    let unverifiedOnly = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i];
      try {
        const res = await fetch("/api/hunter/find-and-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: lead.domain }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Hunter error" }));
          throw new Error(err.error || "Hunter error");
        }
        const data = await res.json();
        const emails: HunterEmailMeta[] = data.emails || [];

        // Strict auto-pick: only `valid` (SMTP-verified) — prevents Klaviyo bounces
        const verified = emails.filter((e) => e.verification_status === "valid");
        verified.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
        const primary = verified[0]?.value || null;

        const patchBody: { email?: string | null; emails: HunterEmailMeta[] } = {
          emails,
        };
        // Only set primary if we found a verified one AND user hasn't typed one
        if (primary && !lead.email) {
          patchBody.email = primary;
        }

        await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        onLeadUpdate?.(lead.id, {
          ...(patchBody.email !== undefined ? { email: patchBody.email } : {}),
          emails: JSON.stringify(emails),
        });

        if (primary) verifiedFound++;
        else if (emails.length > 0) unverifiedOnly++;
      } catch (e) {
        failed++;
        console.error("Hunter failed for", lead.domain, e);
      }
      setHuntProgress({ done: i + 1, total: targets.length });
      await new Promise((r) => setTimeout(r, 200));
    }

    setHunting(false);
    const parts: string[] = [];
    if (verifiedFound > 0) parts.push(`${verifiedFound} verified`);
    if (unverifiedOnly > 0) parts.push(`${unverifiedOnly} unverified only`);
    if (failed > 0) parts.push(`${failed} failed`);

    if (verifiedFound > 0) {
      toast.success(`Hunter complete: ${parts.join(", ")}`);
    } else if (unverifiedOnly > 0) {
      toast.warning(
        `No verified emails found. ${unverifiedOnly} leads have unverified results — check the dropdown to review manually.`
      );
    } else if (failed > 0) {
      toast.error(`All ${failed} Hunter lookups failed — check your API key`);
    } else {
      toast.info("No emails found for any selected domain");
    }
  }, [filtered, selected, onLeadUpdate]);

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      onLeadsDelete?.(ids);
      setSelected(new Set());
      setConfirmingDelete(false);
      toast.success(`Deleted ${data.deleted} ${data.deleted === 1 ? "lead" : "leads"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [selected, onLeadsDelete]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-[#2383e2]" />
    ) : (
      <ChevronDown className="w-3 h-3 text-[#2383e2]" />
    );
  };

  const thClass =
    "px-3 py-2 text-left text-[11px] font-medium text-[#787774] uppercase tracking-wider select-none cursor-pointer hover:bg-[#f1f1ef] group transition-colors";

  return (
    <div className="flex flex-col pb-20">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#9b9a97] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            className="w-full bg-transparent text-[13px] text-[#37352f] placeholder:text-[#9b9a97] pl-8 pr-3 py-1 rounded hover:bg-[#f1f1ef] focus:bg-[#f1f1ef] focus:outline-none transition-colors"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#f1f1ef] transition-colors">
          <Filter className="w-3 h-3 text-[#9b9a97]" />
          <select
            className="bg-transparent text-[12px] text-[#37352f] focus:outline-none cursor-pointer pr-5"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            style={{ backgroundImage: "none", padding: 0 }}
          >
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <span className="text-[12px] text-[#9b9a97] ml-2 tabular-nums">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleExport(true)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-white border border-[#ebebea] text-[#37352f] rounded-md text-[13px] px-2.5 py-1 hover:bg-[#f1f1ef] disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport(true, true)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-[#2383e2] text-white rounded-md text-[13px] px-2.5 py-1 hover:bg-[#1a73d4] disabled:opacity-50 transition-colors"
            title="Export verified emails only, formatted for Klaviyo import"
          >
            <Download className="w-3.5 h-3.5" />
            Export for Klaviyo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border-t border-b border-[#ebebea]">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "36px" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "auto" }} />
          </colgroup>
          <thead className="bg-[#fbfbfa] sticky top-0">
            <tr className="border-b border-[#ebebea]">
              <th className="px-3 py-2 w-8 border-r border-[#ebebea]">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded-[3px] border-[#d9d9d7] text-[#2383e2] focus:ring-[#2383e2] cursor-pointer"
                />
              </th>
              <th className={clsx(thClass, "border-r border-[#ebebea]")} onClick={() => toggleSort("name")}>
                <div className="flex items-center gap-1">
                  Business Name <SortIcon col="name" />
                </div>
              </th>
              <th className={clsx(thClass, "border-r border-[#ebebea]")} onClick={() => toggleSort("address")}>
                <div className="flex items-center gap-1">
                  Address <SortIcon col="address" />
                </div>
              </th>
              <th className={clsx(thClass, "border-r border-[#ebebea]")} onClick={() => toggleSort("domain")}>
                <div className="flex items-center gap-1">
                  Website <SortIcon col="domain" />
                </div>
              </th>
              <th className={clsx(thClass, "border-r border-[#ebebea]")} onClick={() => toggleSort("email")}>
                <div className="flex items-center gap-1">
                  Email <SortIcon col="email" />
                </div>
              </th>
              <th className={clsx(thClass, "border-r border-[#ebebea] w-24")}>Social</th>
              <th className={thClass} onClick={() => toggleSort("subarea")}>
                <div className="flex items-center gap-1">
                  Area <SortIcon col="subarea" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                className={clsx(
                  "border-b border-[#f1f1ef] group transition-colors",
                  selected.has(lead.id) ? "bg-[#e8f0fe]" : "hover:bg-[#fbfbfa]"
                )}
              >
                <td className="px-3 py-2 border-r border-[#f1f1ef]">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleRow(lead.id)}
                    className="rounded-[3px] border-[#d9d9d7] text-[#2383e2] focus:ring-[#2383e2] cursor-pointer opacity-0 group-hover:opacity-100 data-[checked=true]:opacity-100"
                    data-checked={selected.has(lead.id)}
                    style={{ opacity: selected.has(lead.id) ? 1 : undefined }}
                  />
                </td>
                <td className="px-3 py-2 border-r border-[#f1f1ef] text-[13px] font-medium text-[#37352f] truncate" title={lead.name}>
                  {lead.name}
                </td>
                <td className="px-3 py-2 border-r border-[#f1f1ef] text-[13px] text-[#787774] truncate" title={lead.address}>
                  {lead.address}
                </td>
                <td className="px-3 py-2 border-r border-[#f1f1ef] text-[13px] truncate">
                  <a
                    href={`https://${lead.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2383e2] hover:underline inline-flex items-center gap-1 group/link max-w-full"
                    title={lead.domain}
                  >
                    <span className="truncate">{lead.domain}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                  </a>
                </td>
                <td className="px-0 py-0 border-r border-[#f1f1ef] text-[13px]">
                  <EmailCell lead={lead} onLeadUpdate={onLeadUpdate} />
                </td>
                <td className="px-3 py-2 border-r border-[#f1f1ef] text-[13px]">
                  <div className="flex items-center gap-2">
                    {lead.instagram ? (
                      <a
                        href={lead.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#787774] hover:text-[#e4405f] transition-colors"
                        title="Instagram"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[#e0e0dd]">—</span>
                    )}
                    {lead.facebook ? (
                      <a
                        href={lead.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#787774] hover:text-[#1877f2] transition-colors"
                        title="Facebook"
                      >
                        <Facebook className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[#e0e0dd]">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 truncate">
                  <span className="inline-block bg-[#f1f1ef] text-[#787774] rounded px-1.5 py-0.5 text-[11px] font-medium truncate max-w-full" title={lead.subarea}>
                    {lead.subarea}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-16 text-center text-[13px] text-[#9b9a97]">
                  No leads match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-[12px] text-[#787774] tabular-nums">
            Page {page} of {pages} · {total} total
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-2 py-1 rounded text-[12px] text-[#787774] hover:bg-[#f1f1ef] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pages}
              className="flex items-center gap-1 px-2 py-1 rounded text-[12px] text-[#787774] hover:bg-[#f1f1ef] disabled:opacity-30 transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#37352f] rounded-xl px-4 py-2.5 flex items-center gap-4 notion-shadow z-30 animate-fade-in">
          <span className="text-[13px] text-white">
            <span className="font-semibold">{selected.size}</span>
            <span className="text-white/60 ml-1">selected</span>
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            onClick={() => {
              setSelected(new Set());
              setConfirmingDelete(false);
            }}
            className="text-[13px] text-white/70 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleHunter}
            disabled={hunting}
            className="flex items-center gap-1.5 bg-white/10 text-white text-[13px] font-medium rounded-md px-2.5 py-1 hover:bg-white/20 disabled:opacity-50 transition-colors"
            title="Find emails via Hunter.io"
          >
            {hunting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Finding {huntProgress.done}/{huntProgress.total}
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Find emails
              </>
            )}
          </button>
          <button
            onClick={() => handleExport(false)}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-[#2383e2] text-white text-[13px] font-medium rounded-md px-2.5 py-1 hover:bg-[#1a73d4] disabled:opacity-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export selected
          </button>
          <div className="h-4 w-px bg-white/20" />
          {confirmingDelete ? (
            <>
              <span className="text-[12px] text-white/70">Delete {selected.size}?</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="text-[13px] text-white/70 hover:text-white disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 bg-[#eb5757] text-white text-[13px] font-medium rounded-md px-2.5 py-1 hover:bg-[#d94949] disabled:opacity-50 transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Confirm delete
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-[13px] text-white/70 hover:text-[#eb5757] transition-colors"
              title="Delete selected leads"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmailCell({
  lead,
  onLeadUpdate,
}: {
  lead: Lead;
  onLeadUpdate?: (id: string, patch: Partial<Lead>) => void;
}) {
  const [value, setValue] = useState(lead.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hunterEmails: HunterEmailMeta[] = useMemo(() => {
    if (!lead.emails) return [];
    try {
      const parsed = JSON.parse(lead.emails);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [lead.emails]);

  // Look up status of the currently-shown email (if it came from Hunter)
  const currentStatus: HunterVerificationStatus = useMemo(() => {
    if (!value) return null;
    const match = hunterEmails.find((e) => e.value === value);
    return match ? match.verification_status : null;
  }, [value, hunterEmails]);

  useEffect(() => {
    setValue(lead.email || "");
  }, [lead.email]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const save = useCallback(
    async (next: string) => {
      const current = lead.email || "";
      if (next === current) return;
      setSaving(true);
      setError(false);
      try {
        const res = await fetch(`/api/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: next }),
        });
        if (!res.ok) throw new Error("Save failed");
        onLeadUpdate?.(lead.id, { email: next || null });
      } catch {
        setError(true);
        setValue(current);
      } finally {
        setSaving(false);
      }
    },
    [lead.id, lead.email, onLeadUpdate]
  );

  const commit = useCallback(() => save(value.trim()), [save, value]);

  const pick = useCallback(
    (email: string) => {
      setValue(email);
      setMenuOpen(false);
      save(email);
    },
    [save]
  );

  return (
    <div ref={wrapRef} className="relative flex items-center h-full">
      {value && currentStatus && (
        <span className="pl-2 shrink-0">
          <VerificationDot status={currentStatus} />
        </span>
      )}
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            setValue(lead.email || "");
            inputRef.current?.blur();
          }
        }}
        placeholder="Add email…"
        disabled={saving}
        className={clsx(
          "flex-1 min-w-0 h-full py-2 text-[13px] bg-transparent outline-none border border-transparent rounded-none placeholder:text-[#c4c4c1]",
          value && currentStatus ? "pl-1.5 pr-3" : "px-3",
          "focus:bg-white focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/20",
          error ? "text-[#eb5757]" : value ? "text-[#37352f]" : "text-[#787774]"
        )}
        title={
          error
            ? "Save failed — try again"
            : currentStatus
              ? `${value} — ${verificationMeta(currentStatus).label}`
              : value || "Click to add email"
        }
      />
      {hunterEmails.length > 1 && (
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="shrink-0 flex items-center gap-0.5 px-1.5 mr-1 h-6 rounded text-[11px] font-medium text-[#787774] bg-[#f1f1ef] hover:bg-[#e8e8e5] transition-colors"
          title={`${hunterEmails.length} emails from Hunter`}
        >
          +{hunterEmails.length - 1}
          <ChevronDown className="w-3 h-3" />
        </button>
      )}
      {menuOpen && hunterEmails.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-[#ebebea] rounded-lg notion-shadow z-20 py-1 max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-medium text-[#9b9a97] uppercase tracking-wider border-b border-[#f1f1ef]">
            Hunter results
          </div>
          {hunterEmails
            .slice()
            .sort((a, b) => {
              // Verified first, then by confidence
              const aValid = a.verification_status === "valid" ? 1 : 0;
              const bValid = b.verification_status === "valid" ? 1 : 0;
              if (aValid !== bValid) return bValid - aValid;
              return (b.confidence ?? 0) - (a.confidence ?? 0);
            })
            .map((e) => {
              const isActive = e.value === value;
              const name = [e.first_name, e.last_name].filter(Boolean).join(" ");
              return (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => pick(e.value)}
                  className={clsx(
                    "w-full text-left px-3 py-2 hover:bg-[#f7f7f5] transition-colors flex items-start gap-2",
                    isActive && "bg-[#f1f1ef]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <VerificationDot status={e.verification_status} />
                      <span className="text-[13px] text-[#37352f] truncate">{e.value}</span>
                      {isActive && <Check className="w-3 h-3 text-[#2383e2] shrink-0" />}
                    </div>
                    <div className="text-[12px] text-[#787774] truncate pl-3.5">
                      <VerificationLabel status={e.verification_status} />
                      {(name || e.position) && (
                        <>
                          {" · "}
                          {name}
                          {name && e.position ? " · " : ""}
                          {e.position}
                        </>
                      )}
                    </div>
                  </div>
                  {e.confidence != null && (
                    <span
                      className={clsx(
                        "text-[11px] font-medium tabular-nums shrink-0 px-1.5 py-0.5 rounded",
                        e.confidence >= 80
                          ? "bg-[#edf8f4] text-[#4dab9a]"
                          : e.confidence >= 50
                            ? "bg-[#fbf3db] text-[#c28b2d]"
                            : "bg-[#f1f1ef] text-[#787774]"
                      )}
                    >
                      {e.confidence}%
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function verificationMeta(status: HunterVerificationStatus) {
  switch (status) {
    case "valid":
      return { label: "Verified", color: "bg-[#4dab9a]", textColor: "text-[#4dab9a]" };
    case "accept_all":
      return { label: "Catch-all", color: "bg-[#c28b2d]", textColor: "text-[#c28b2d]" };
    case "webmail":
      return { label: "Webmail", color: "bg-[#c28b2d]", textColor: "text-[#c28b2d]" };
    case "invalid":
      return { label: "Invalid", color: "bg-[#eb5757]", textColor: "text-[#eb5757]" };
    case "disposable":
      return { label: "Disposable", color: "bg-[#eb5757]", textColor: "text-[#eb5757]" };
    case "pending":
      return { label: "Pending", color: "bg-[#9b9a97]", textColor: "text-[#9b9a97]" };
    case "unknown":
    case null:
    default:
      return { label: "Unknown", color: "bg-[#c4c4c1]", textColor: "text-[#9b9a97]" };
  }
}

function VerificationDot({ status }: { status: HunterVerificationStatus }) {
  const meta = verificationMeta(status);
  return (
    <span
      className={clsx("w-1.5 h-1.5 rounded-full shrink-0", meta.color)}
      title={meta.label}
    />
  );
}

function VerificationLabel({ status }: { status: HunterVerificationStatus }) {
  const meta = verificationMeta(status);
  return <span className={clsx("font-medium", meta.textColor)}>{meta.label}</span>;
}
