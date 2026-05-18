"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}

export default function PageHeader({
  emoji,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="pt-12 pb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 mb-6 text-[13px] text-[#787774]">
          {breadcrumbs.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-[#9b9a97]" />}
              {c.href ? (
                <Link
                  href={c.href}
                  className="hover:bg-[#f1f1ef] rounded px-1 py-0.5 -mx-1 transition-colors"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="px-1 py-0.5 -mx-1">{c.label}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-3 text-[30px] font-bold tracking-tight text-[#37352f] leading-tight">
            {emoji && <span className="text-[32px] leading-none">{emoji}</span>}
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] text-[#787774] mt-2">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
