import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/voice/config — tells the client which voice providers are available
export async function GET() {
  return NextResponse.json({
    elevenlabsStt: Boolean(process.env.ELEVENLABS_API_KEY),
    elevenlabsTts: Boolean(process.env.ELEVENLABS_API_KEY),
  });
}
