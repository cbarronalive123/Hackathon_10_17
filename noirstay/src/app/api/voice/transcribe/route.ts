import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/voice/transcribe — multipart audio -> text via ElevenLabs speech-to-text
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured. Add ELEVENLABS_API_KEY to enable server transcription." },
      { status: 501 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No audio provided." }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("file", file, file.name || "recording.webm");
    upstream.append("model_id", "scribe_v1");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("ElevenLabs S2T error", res.status, errText);
      return NextResponse.json({ error: "Transcription failed." }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ text: String(data.text ?? "").trim() });
  } catch (err) {
    console.error("transcribe error", err);
    return NextResponse.json({ error: "Transcription failed." }, { status: 500 });
  }
}
