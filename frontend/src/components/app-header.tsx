"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserSwitcher } from "./user-switcher";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-[#0A0A0A] shrink-0">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10h1l1-2h2l1 2h1m4 0h1l1-2h2l1 2h1M4 10v6a2 2 0 002 2h12a2 2 0 002-2v-6M6 6l2-4h8l2 4"
          />
        </svg>
        <span className="text-sm font-semibold text-white">指摘管理ツール</span>
      </div>
      <nav className="flex items-center gap-6">
        <Link
          href="/viewer"
          className={`text-[13px] ${
            pathname === "/viewer"
              ? "font-semibold text-white"
              : "font-normal text-zinc-400 hover:text-zinc-200"
          }`}
        >
          3D ビューワー
        </Link>
        <Link
          href="/issues"
          className={`text-[13px] ${
            pathname === "/issues"
              ? "font-semibold text-white"
              : "font-normal text-zinc-400 hover:text-zinc-200"
          }`}
        >
          指摘一覧
        </Link>
      </nav>
      <div className="flex items-center gap-4">
        <span className="text-[13px] text-zinc-400">現場A棟</span>
        <UserSwitcher />
      </div>
    </header>
  );
}
