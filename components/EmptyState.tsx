import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#f1f1ef] to-[#e5e5e3] flex items-center justify-center mb-5 shadow-sm">
        <Sparkles className="w-6 h-6 text-[#9b9a97]" strokeWidth={1.5} />
      </div>
      <h2 className="text-[18px] font-semibold text-[#37352f] mb-1.5">
        Get started with your first search
      </h2>
      <p className="text-[14px] text-[#787774] mb-6 max-w-sm">
        Discover local food &amp; drink businesses across the UK. Every project exports a clean CSV
        ready for Hunter.io enrichment.
      </p>
      <Link
        href="/search/new"
        className="inline-flex items-center gap-1.5 bg-[#37352f] text-white rounded-md text-[13px] font-medium px-3 py-2 hover:bg-[#4a4845] transition-colors shadow-sm"
      >
        Create new search
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
