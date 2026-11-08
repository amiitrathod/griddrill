import { NextResponse } from "next/server";
import { EVENT_NAMES } from "@/lib/analytics";

/** Receives anonymous product events. Logged as one JSON line each; forward them to your analytics tool in production. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!EVENT_NAMES.includes(body?.name)) return NextResponse.json({ ok: false }, { status: 400 });
    console.log(JSON.stringify({ evt: body.name, ...body.props, at: body.at }));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
