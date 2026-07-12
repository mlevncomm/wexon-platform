import type { ReactNode, SVGProps } from "react";
import type { WexonIconName } from "@/types/wexon";

const PATHS: Record<WexonIconName, ReactNode> = {
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 21h18M5 21V5a1 1 0 011-1h12a1 1 0 011 1v16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M10 21v-4h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  b2b: (
    <>
      <path d="M3 9l9-6 9 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5M3 17l9 5 9-5" strokeLinejoin="round" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0" strokeLinecap="round" />
      <path d="M16 6a3 3 0 010 6M21 20a5 5 0 00-4-5" strokeLinecap="round" />
    </>
  ),
  catalog: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" strokeLinecap="round" />
    </>
  ),
  license: (
    <>
      <circle cx="9" cy="12" r="4" />
      <path d="M13 12h8M17 12v4M21 12v3" strokeLinecap="round" />
    </>
  ),
  subscription: (
    <>
      <path d="M3 12a9 9 0 0115.5-6.3L21 8" strokeLinecap="round" />
      <path d="M21 4v4h-4M21 12a9 9 0 01-15.5 6.3L3 16" strokeLinecap="round" />
      <path d="M3 20v-4h4" strokeLinecap="round" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" strokeLinecap="round" />
    </>
  ),
  entitlement: (
    <>
      <path d="M12 2l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9M17 17l2-2M15 15l2-2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  audit: (
    <>
      <path d="M5 3h11l3 3v15l-3-2-2 2-3-2-3 2-3-2V3z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 004 0" strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" strokeLinejoin="round" />
    </>
  ),
  isolation: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <path d="M12 8v8" strokeLinecap="round" strokeDasharray="2 2" />
    </>
  ),
  webhook: (
    <>
      <circle cx="7" cy="9" r="3" />
      <path d="M9 11l4 7M7 12v2a4 4 0 004 4h2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="17" r="3" />
    </>
  ),
  adapter: (
    <>
      <rect x="3" y="8" width="8" height="8" rx="1.5" />
      <path d="M11 12h4M15 9v6a1 1 0 001 1h4M20 9h-4a1 1 0 00-1 1" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M15 9v11" strokeLinecap="round" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </>
  ),
  team: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20a6 6 0 0112 0M15 20a5 5 0 017-4.6" strokeLinecap="round" />
    </>
  ),
  products: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="3" y="16" width="8" height="5" rx="1.5" />
      <rect x="13" y="12" width="8" height="9" rx="1.5" />
    </>
  ),
  customers: (
    <>
      <path d="M4 21V6a1 1 0 011-1h8a1 1 0 011 1v15" strokeLinejoin="round" />
      <path d="M14 21V10a1 1 0 011-1h4a1 1 0 011 1v11" strokeLinejoin="round" />
      <path d="M7 9h1M10 9h1M7 13h1M10 13h1M17 13h1" strokeLinecap="round" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" strokeLinecap="round" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="M4 12.5L9 17.5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />,
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 12h10L20 8H6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  order: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </>
  ),
  track: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  pay: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" strokeLinecap="round" />
      <circle cx="17" cy="15" r="1.5" />
    </>
  ),
};

interface WexonIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: WexonIconName;
  size?: number;
}

export function WexonIcon({ name, size = 22, strokeWidth = 1.8, ...props }: WexonIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
