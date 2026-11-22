"use client";
import { useEffect, useRef, useState } from "react";
import { DoubleClap } from "@/lib/double-clap";
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
export function useDoubleClap(onClap: () => void, allowed: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState("Desactivado");
  const [error, setError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const callback = useRef(onClap);
  useEffect(() => { callback.current = onClap; }, [onClap]);
  function disable() { setEnabled(false); }
  function enable() {
    setError("");
    const Constructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Constructor || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite analizar el micrófono. Usa el ojo para hablar."); return;
    }
    try {
      if (!context.current || context.current.state === "closed") context.current = new Constructor();
      void context.current.resume().catch(() => { setError("Safari bloqueó el análisis de audio. Desactiva y vuelve a activar con un toque."); setEnabled(false); });
      setEnabled(true);
    } catch { setError("No se pudo abrir el audio local del dispositivo."); }
  }
  useEffect(() => {
    if (!enabled) {
      const previous = context.current; context.current = null;
      if (previous && previous.state !== "closed") void previous.close().catch(() => {});
      return;
    }
    const hide = () => { if (document.hidden) setEnabled(false); };
    const leave = () => setEnabled(false);
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", leave);
    // Explicit local listening session; never leave an unattended microphone open.
    const expiry = setTimeout(() => setEnabled(false), 10 * 60 * 1000);
    return () => { clearTimeout(expiry); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !allowed) return;
    let cancelled = false, frame = 0;
    let stream: MediaStream | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    const stop = () => { cancelAnimationFrame(frame); try { source?.disconnect(); } catch { /* Already detached. */ } stream?.getTracks().forEach((track) => track.stop()); };
    const timer = setTimeout(() => setState("Solicitando permiso de micrófono…"), 0);
    void navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }).then((received) => {
      stream = received;
      if (cancelled) { stop(); return; }
      const ctx = context.current;
      if (!ctx || ctx.state !== "running") {
        stop(); setError("Safari suspendió el analizador. Desactiva y vuelve a activar con un toque."); setEnabled(false); return;
      }
      source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
      source.connect(analyser); // Never connect captured microphone to the speakers.
      const samples = new Float32Array(analyser.fftSize);
      const detector = new DoubleClap();
      const started = performance.now();
      setState("Escuchando dos aplausos · análisis local");
      const sample = () => {
        if (cancelled) return;
        try { analyser.getFloatTimeDomainData(samples); } catch {
          stop(); setError("El analizador de audio se detuvo. Usa el ojo para hablar."); setEnabled(false); return;
        }
        let sum = 0, peak = 0;
        for (const value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
        const time = performance.now();
        if (time - started > 500 && detector.feed(Math.sqrt(sum / samples.length), peak, time)) {
          // Release capture BEFORE speech recognition acquires the iPad microphone.
          stop(); cancelled = true; setState("Dos aplausos detectados"); callback.current(); return;
        }
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    }).catch(() => { stop(); if (!cancelled) { setError("No se pudo acceder al micrófono. Revisa el permiso de Safari; el ojo sigue disponible."); setEnabled(false); } });
    return () => { cancelled = true; clearTimeout(timer); stop(); };
  }, [enabled, allowed]);
  useEffect(() => () => {
    const ctx = context.current;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
  }, []);
  return { enabled, state: !enabled ? "Desactivado" : !allowed ? "Pausado durante la conversación" : state, error, enable, disable };
}
