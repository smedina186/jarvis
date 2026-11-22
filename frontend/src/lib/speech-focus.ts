// speechSynthesis is global to the document. Only its current owner may cancel it.
let lease: { owner: symbol; revoked: () => void } | null = null;
export function claimSpeech(owner: symbol, revoked: () => void) {
  if (lease && lease.owner !== owner) {
    const previous = lease; lease = null;
    previous.revoked();
    try { window.speechSynthesis?.cancel(); } catch { /* Native engine unavailable. */ }
  }
  lease = { owner, revoked };
  setAudioSession("playback");
}
export function ownsSpeech(owner: symbol) { return lease?.owner === owner; }
export function releaseSpeech(owner: symbol, cancel = true) {
  if (!ownsSpeech(owner)) return;
  lease = null;
  if (cancel) { try { window.speechSynthesis?.cancel(); } catch { /* Native engine unavailable. */ } }
  setAudioSession("auto");
}

// Optional Audio Session API (Safari): restore playback after microphone use.
// Never assume support, and never select an output device or bypass permissions.
export function setAudioSession(type: "auto" | "playback" | "play-and-record") {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = type;
  } catch { /* Experimental API; native routing remains available. */ }
}

export function settleAudioSession() {
  setAudioSession(lease ? "playback" : "auto");
}
