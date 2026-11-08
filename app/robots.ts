import type { MetadataRoute } from "next";
import { PRODUCT } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/verify/", "/account"] }, sitemap: `${PRODUCT.siteUrl}/sitemap.xml` };
}
