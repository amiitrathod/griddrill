import type { MetadataRoute } from "next";
import { getAllLessons } from "@/lib/content";
import { FUNCTION_PAGES } from "@/lib/functions-seo";
import { PRODUCT } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = PRODUCT.siteUrl;
  const pages = ["", "/lessons", "/shortcuts", "/practice", "/pricing", "/placement", "/about", "/contact", "/privacy", "/terms", "/accessibility"];
  return [
    ...pages.map((p) => ({ url: base + p })),
    ...FUNCTION_PAGES.map((f) => ({ url: `${base}/functions/${f.slug}` })),
    ...getAllLessons().map((l) => ({ url: `${base}/lessons/${l.id}` })),
  ];
}
