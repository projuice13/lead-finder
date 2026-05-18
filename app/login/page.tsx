"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "projuice") {
      document.cookie = "auth=projuice; path=/; max-age=604800";
      router.push("/");
      router.refresh();
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-6">
      {/* Decorative gradient blob */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-[#e8f0fe] rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-[#fbf3db] rounded-full blur-3xl opacity-40" />
      </div>

      <div className="relative w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2383e2] to-[#1a73d4] flex items-center justify-center shadow-md">
            <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[18px] font-bold tracking-tight text-[#37352f]">
            Lead Finder
          </span>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#ebebea] rounded-xl p-7 notion-shadow">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3.5 h-3.5 text-[#787774]" />
            <h1 className="text-[14px] font-semibold text-[#37352f]">
              Enter password to continue
            </h1>
          </div>
          <p className="text-[13px] text-[#787774] mb-5">
            This tool is password protected.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              autoFocus
              className="w-full border border-[#ebebea] rounded-md px-3 py-2 text-[14px] text-[#37352f] placeholder:text-[#9b9a97] hover:border-[#d9d9d7] focus:outline-none focus:border-[#2383e2] focus:ring-2 focus:ring-[#2383e2]/15 transition-all"
            />
            {error && (
              <p className="text-[12px] text-[#eb5757] flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#eb5757]" />
                Incorrect password. Try again.
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-[#2383e2] text-white rounded-md text-[13px] font-medium py-2 hover:bg-[#1a73d4] transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#9b9a97] mt-6">
          UK food & drink business lead discovery
        </p>
      </div>
    </div>
  );
}
