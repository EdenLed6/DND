"use client";
// Mobile bottom navigation for the Player Portal — SPEC-v2 §5 (player).
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PersonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </svg>
  );
}
function BannerIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 3v18M6 4h12l-2.5 4L18 12H6" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </svg>
  );
}
function D20Icon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z" />
      <path d="M12 7.5L7 15h10l-5-7.5z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </svg>
  );
}

const ITEMS = [
  { href: "/dashboard", label: "Characters", icon: <PersonIcon /> },
  { href: "/dashboard#campaigns", label: "Campaigns", icon: <BannerIcon />, activePath: "/campaigns" },
  { href: "/compendium", label: "Compendium", icon: <BookIcon /> },
  { href: "/profile", label: "Profile", icon: <GearIcon /> },
];

export function PlayerNav() {
  const pathname = usePathname();
  const isActive = (item: (typeof ITEMS)[number]) => {
    const base = item.activePath ?? item.href.split("#")[0];
    if (base === "/dashboard") return pathname === "/dashboard" && !item.activePath;
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <nav className="bottom-nav sm:hidden" aria-label="Primary">
      {ITEMS.map((item) => (
        <Link key={item.label} href={item.href} data-active={isActive(item)}>
          <span className="ico">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
