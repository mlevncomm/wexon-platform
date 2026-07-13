import type { MetadataRoute } from "next";

const SITE_URL = "https://www.wexon.dev";

const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products/wexpay", priority: 0.95, changeFrequency: "weekly" },
  { path: "/products/wexhotel", priority: 0.65, changeFrequency: "monthly" },
  { path: "/products/wexb2b", priority: 0.65, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/iletisim", priority: 0.6, changeFrequency: "monthly" },
  { path: "/book-demo", priority: 0.6, changeFrequency: "monthly" },
  { path: "/demo-request", priority: 0.6, changeFrequency: "monthly" },
  { path: "/start", priority: 0.55, changeFrequency: "monthly" },
  { path: "/apply", priority: 0.5, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.45, changeFrequency: "weekly" },
  { path: "/docs", priority: 0.45, changeFrequency: "weekly" },
  { path: "/api-reference", priority: 0.4, changeFrequency: "monthly" },
  { path: "/status", priority: 0.35, changeFrequency: "daily" },
  { path: "/changelog", priority: 0.35, changeFrequency: "weekly" },
  { path: "/careers", priority: 0.3, changeFrequency: "monthly" },
  { path: "/links", priority: 0.3, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.25, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.25, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.25, changeFrequency: "yearly" },
  { path: "/legal/security", priority: 0.25, changeFrequency: "yearly" },
  { path: "/kvkk", priority: 0.25, changeFrequency: "yearly" },
  { path: "/gizlilik", priority: 0.25, changeFrequency: "yearly" },
  { path: "/gizlilik-politikasi", priority: 0.25, changeFrequency: "yearly" },
  { path: "/kullanim-sartlari", priority: 0.25, changeFrequency: "yearly" },
  { path: "/cerez-politikasi", priority: 0.25, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
