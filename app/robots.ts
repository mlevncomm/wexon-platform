import type { MetadataRoute } from "next";

const SITE_URL = "https://www.wexon.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/dashboard",
          "/dashboard/",
          "/apps",
          "/apps/",
          "/api",
          "/api/",
          "/checkout",
          "/login",
          "/signup",
          "/wexpay/t",
          "/wexpay/t/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
