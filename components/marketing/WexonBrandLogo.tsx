import Image from "next/image";
import {
  WEXON_BRAND_LOGO_BOX_CLASS,
  WEXON_BRAND_LOGO_SIZES,
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
      <Image
        src={WEXON_BRAND_LOGOS[variant]}
        alt="Wexon"
        fill
        className="object-contain"
        sizes={WEXON_BRAND_LOGO_SIZES}
        priority={priority}
      />
    </span>
  );
}
