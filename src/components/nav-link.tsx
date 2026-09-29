"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = new URL(href, "http://x");
  const current = pathname + (searchParams.size ? `?${searchParams}` : "");
  const active =
    current === href ||
    (url.search === "" && pathname.startsWith(url.pathname) && url.pathname !== "/notes");

  return (
    <Link
      href={href}
      className={`block truncate rounded-md px-2 py-1.5 ${
        active ? "bg-brand-100 font-medium text-accent" : "text-stone-700 hover:bg-stone-200"
      }`}
    >
      {children}
    </Link>
  );
}
