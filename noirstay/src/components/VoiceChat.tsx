"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Hotel } from "@/lib/types";

type Msg = {
  role: "user" | "assistant";
  content: string;
  hotels?: Hotel[];
};

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Good evening. I'm the NoirStay concierge. Tell me where you're headed — city, budget, dates — and I'll find your stay. Tap the microphone and just speak.",
};

export default function VoiceChat() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState<{ elevenlabsStt: boolean; elevenlabsTts: boolean } | null>(null);
  const sessionIdRef = useRef<string>("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let sid = sessionStorage.getItem("noirstay_chat_sid");
    if (!sid) {
      sid = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("noirstay_chat_sid", sid);
    }
    sessionIdRef.current = sid;

    fetch("/api/voice/config")
      .then((r) => r.json())
      .then((cfg) => setVoiceConfig(cfg))
      .catch(() => setVoiceConfig({ elevenlabsStt: false, elevenlabsTts: false }));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const speak = useCallback(async (text: string) => {
    if (!speakerOn) return;
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        return;
      }
    } catch {
      // fall through to browser speech
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, [speakerOn]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: text }]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, message: text }),
        });
        const data = await res.json();
        const reply = res.ok
          ? data.reply
          : data.error || "The concierge is unavailable right now — please try again.";
        const hotels: Hotel[] = Array.isArray(data.hotels) ? data.hotels : [];
        setMessages((m) => [...m, { role: "assistant", content: reply, hotels }]);
        void speak(reply);
      } catch {
        const reply = "Connection lost. Please try again.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, speak]
  );

  const startElevenLabsRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 2000) {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: "I didn't catch any audio — try holding the mic a little longer." },
          ]);
          return;
        }
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        setBusy(true);
        try {
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (res.ok && data.text) {
            await send(data.text);
          } else {
            setMessages((m) => [
              ...m,
              { role: "assistant", content: data.error || "Transcription failed — please try typing." },
            ]);
          }
        } catch {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: "Transcription failed — please try typing." },
          ]);
        } finally {
          setBusy(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setListening(true);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Microphone access was blocked. Enable it in your browser to use voice." },
      ]);
    }
  }, [send]);

  const startWebSpeech = useCallback(async () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      await startElevenLabsRecording();
      return;
    }
    const rec: SpeechRecognitionLike = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalText = "";
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setInput(finalText || interim);
    };
    rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
      setListening(false);
      if (e.error === "not-allowed") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Microphone access was blocked. Enable it in your browser to use voice." },
        ]);
      }
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        void send(finalText);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [send, startElevenLabsRecording]);

  const toggleMic = useCallback(() => {
    if (busy) return;
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        setListening(false);
      }
      return;
    }
    if (voiceConfig?.elevenlabsStt) {
      void startElevenLabsRecording();
    } else {
      void startWebSpeech();
    }
  }, [busy, listening, voiceConfig, startElevenLabsRecording, startWebSpeech]);

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-black/60 shadow-[0_0_60px_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            AI Concierge
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Talk to NoirStay</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setSpeakerOn((v) => !v);
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
          }}
          title={speakerOn ? "Voice replies on" : "Voice replies off"}
          className={`rounded-lg border p-2.5 transition-colors ${
            speakerOn
              ? "border-zinc-400 bg-zinc-100 text-black"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <div key={i} className={`fade-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "border-zinc-600 bg-zinc-100 text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-200"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.hotels && m.hotels.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.hotels.map((h) => (
                    <Link
                      key={h.id}
                      href={`/hotels/${h.id}`}
                      className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-black px-3 py-2 transition-colors hover:border-zinc-500"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{h.name}</p>
                        <p className="text-xs text-zinc-500">
                          {h.city}, {h.country} · {h.star_rating}★ · {h.guest_rating}/10
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-zinc-200">
                        ${h.price_per_night}
                        <span className="text-xs font-normal text-zinc-500">/night</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="inline-flex gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-zinc-800 p-4"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            title={listening ? "Stop recording" : "Speak to the concierge"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-40 ${
              listening
                ? "mic-listening border-white bg-white text-black"
                : "border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Where are you headed?"}
            className="h-11 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-11 shrink-0 rounded-lg bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-zinc-600">
          {listening
            ? "Listening — tap the mic again to stop."
            : voiceConfig?.elevenlabsStt
              ? "Voice powered by ElevenLabs · answers by Spur GLM"
              : "Voice input uses your browser's speech recognition · answers by Spur GLM"}
        </p>
      </form>
    </div>
  );
}
