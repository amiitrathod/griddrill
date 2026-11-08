import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCertificate } from "@/lib/server/tests-store";
import { PRODUCT } from "@/lib/config";
import { tokens } from "@/docs/design-tokens";

export const dynamic = "force-dynamic";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const c = await getCertificate(params.code.toUpperCase());
  if (!c) return new Response("Not found", { status: 404 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = hex(tokens.color.ink);
  const grey = hex(tokens.color.neutral[600]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: ink, borderWidth: 2 });
  const safe = (t: string) => t.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"); // standard fonts cover Latin-1 only
  const center = (t0: string, y: number, size: number, f = reg, color = ink) => { const t = safe(t0); page.drawText(t, { x: (width - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color }); };
  center(PRODUCT.name.toUpperCase(), height - 90, 14, bold, hex(tokens.color.primary));
  center("Certificate of test completion", height - 150, 32, bold);
  center("This certifies that", height - 205, 14, reg, grey);
  center(c.holder_name, height - 260, 36, bold);
  center(`completed the ${c.test_title} with a score of ${Math.round(c.score)}%`, height - 310, 16);
  center(`Issued ${new Date(c.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, height - 345, 13, reg, grey);
  center(`Verify at ${PRODUCT.siteUrl.replace(/^https?:\/\//, "")}/verify/${c.verification_code}`, 110, 12, reg, ink);
  center(`Certificate code ${c.verification_code}`, 90, 11, reg, grey);
  center("This certificate shows completion of a Gridwise test. It is not an accredited qualification.", 60, 10, reg, grey);
  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.verification_code}.pdf"` } });
}
