import type { MetadataRoute } from "next";
import { WEXON_DEFAULT_DESCRIPTION, WEXON_SITE_NAME, WEXON_SITE_URL } from "@/lib/wexon-site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: WEXON_SITE_NAME,
    short_name: WEXON_SITE_NAME,
    description: WEXON_DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#03150f",
    theme_color: "#03150f",
    lang: "tr",
    icons: [
      {
        src: "/icon",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    id: WEXON_SITE_URL,
  };
}
