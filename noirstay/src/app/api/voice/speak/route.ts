import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/voice/speak — text -> audio via ElevenLabs text-to-speech
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured. Add ELEVENLABS_API_KEY to enable voice replies." },
      { status: 501 }
    );
  }

  try {
    const { text } = await req.json();
    const clean = String(text ?? "").trim().slice(0, 800);
    if (!clean) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clean,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("ElevenLabs TTS error", res.status, errText);
      return NextResponse.json({ error: "Speech synthesis failed." }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("speak error", err);
    return NextResponse.json({ error: "Speech synthesis failed." }, { status: 500 });
  }
}
