"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SiteNav() {
  const pathname = usePathname();
  return <nav aria-label="Primary navigation">{[["/", "Chambers"], ["/battles", "The Pit"], ["/chronicle", "Chronicle"], ["/showcase", "Showcase"], ["/create", "Create"], ["/health", "Health"]].map(([href, label]) => {
    const active = href === "/" ? pathname === "/" || pathname.startsWith("/chambers/") : pathname.startsWith(href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}>{label}</Link>;
  })}</nav>;
}
