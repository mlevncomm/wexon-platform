import {
  WEXON_BRAND_LOGO_BOX_CLASS,
  WEXON_BRAND_LOGO_STYLE,
  WEXON_BRAND_LOGOS,
} from "@/components/marketing/wexon-brand-logo";

export default function WexonBrandLogo({
  variant = "dark",
  priority = false,
  className = "",
}: {
  variant?: keyof typeof WEXON_BRAND_LOGOS;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={`${WEXON_BRAND_LOGO_BOX_CLASS} ${className}`} style={WEXON_BRAND_LOGO_STYLE}>
      {/* SVG lockups: native img avoids next/image SVG optimization limits. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={WEXON_BRAND_LOGOS[variant]}
        alt="Wexon"
        className="h-full w-full object-contain object-left"
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </span>
  );
}
