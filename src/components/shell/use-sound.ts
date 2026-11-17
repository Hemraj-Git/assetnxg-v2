"use client";

import { useLocalPreference } from "@/lib/use-local-preference";

// "Sound for new alerts" (v1: a chime on new alerts once the browser allows
// audio, i.e. after the first tap or key). Per device, on by default.

const SOUND_KEY = "assetnxg-sound";

export function useSoundPreference(): [boolean, (on: boolean) => void] {
  const [value, setValue] = useLocalPreference(
    SOUND_KEY,
    (raw) => (raw === "off" ? "off" : "on"),
    "on",
  );
  return [value === "on", (on) => setValue(on ? "on" : "off")];
}

let audio: AudioContext | null = null;

/** Browsers allow sound only after a user gesture; call this from one. */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null; // no Web Audio: stay silent
  }
}

/** A short, soft two-note chime. Silent until unlockAudio() has run. */
export function playChime(): void {
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime;
  const notes: [frequency: number, offset: number][] = [
    [880, 0],
    [1318.5, 0.12],
  ];
  for (const [frequency, offset] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const t = start + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}
