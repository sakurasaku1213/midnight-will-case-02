export type SfxCue =
  | 'success'
  | 'pressure'
  | 'damage'
  | 'evidence'
  | 'select'
  | 'chapter'
  | 'court'
  | 'deduction'
  | 'verdict';

let audioContext: AudioContext | undefined;
let audioUnlocked = false;
let audioUnlockListenersInstalled = false;

export function playSfx(cue: SfxCue, volume: number): void {
  if (typeof window === 'undefined' || volume <= 0) return;
  installAudioUnlockListeners();
  if (navigator.userActivation?.hasBeenActive || navigator.userActivation?.isActive) {
    audioUnlocked = true;
  }
  if (!audioUnlocked) return;

  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    audioContext ??= new AudioContextCtor();
    void audioContext.resume();

    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(Math.min(0.42, Math.max(0, volume) * 0.42), now);
    master.connect(audioContext.destination);

    const tones = getToneSequence(cue);
    tones.forEach((tone, index) => {
      const start = now + tone.offset + index * 0.015;
      const oscillator = audioContext?.createOscillator();
      const gain = audioContext?.createGain();
      if (!oscillator || !gain || !audioContext) return;

      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + tone.duration);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
    });

    window.setTimeout(() => master.disconnect(), 520);
  } catch {
    // Sound is decorative; keep gameplay available if Web Audio is unavailable.
  }
}

function installAudioUnlockListeners(): void {
  if (audioUnlockListenersInstalled || typeof window === 'undefined') return;
  audioUnlockListenersInstalled = true;

  const unlock = () => {
    audioUnlocked = true;
    void audioContext?.resume();
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

function getToneSequence(cue: SfxCue) {
  switch (cue) {
    case 'success':
      return [
        { frequency: 523, endFrequency: 659, duration: 0.1, gain: 0.42, offset: 0, type: 'triangle' as OscillatorType },
        { frequency: 784, duration: 0.13, gain: 0.34, offset: 0.09, type: 'triangle' as OscillatorType },
      ];
    case 'pressure':
      return [
        { frequency: 196, endFrequency: 330, duration: 0.11, gain: 0.44, offset: 0, type: 'sawtooth' as OscillatorType },
        { frequency: 392, duration: 0.08, gain: 0.28, offset: 0.08, type: 'square' as OscillatorType },
      ];
    case 'damage':
      return [
        { frequency: 220, endFrequency: 92, duration: 0.18, gain: 0.42, offset: 0, type: 'sawtooth' as OscillatorType },
        { frequency: 130, endFrequency: 72, duration: 0.18, gain: 0.28, offset: 0.035, type: 'square' as OscillatorType },
      ];
    case 'evidence':
      return [
        { frequency: 659, duration: 0.07, gain: 0.32, offset: 0, type: 'sine' as OscillatorType },
        { frequency: 988, duration: 0.09, gain: 0.24, offset: 0.06, type: 'sine' as OscillatorType },
      ];
    case 'select':
      return [
        { frequency: 440, endFrequency: 520, duration: 0.055, gain: 0.22, offset: 0, type: 'triangle' as OscillatorType },
      ];
    case 'chapter':
      return [
        { frequency: 196, duration: 0.08, gain: 0.22, offset: 0, type: 'triangle' as OscillatorType },
        { frequency: 294, duration: 0.1, gain: 0.24, offset: 0.07, type: 'triangle' as OscillatorType },
        { frequency: 392, duration: 0.13, gain: 0.2, offset: 0.16, type: 'sine' as OscillatorType },
      ];
    case 'court':
      return [
        { frequency: 147, endFrequency: 196, duration: 0.14, gain: 0.34, offset: 0, type: 'sawtooth' as OscillatorType },
        { frequency: 294, duration: 0.08, gain: 0.18, offset: 0.11, type: 'square' as OscillatorType },
        { frequency: 440, duration: 0.1, gain: 0.18, offset: 0.19, type: 'square' as OscillatorType },
      ];
    case 'deduction':
      return [
        { frequency: 330, duration: 0.1, gain: 0.18, offset: 0, type: 'sine' as OscillatorType },
        { frequency: 392, duration: 0.1, gain: 0.2, offset: 0.08, type: 'sine' as OscillatorType },
        { frequency: 494, duration: 0.16, gain: 0.22, offset: 0.17, type: 'triangle' as OscillatorType },
      ];
    case 'verdict':
      return [
        { frequency: 98, endFrequency: 130, duration: 0.18, gain: 0.3, offset: 0, type: 'sawtooth' as OscillatorType },
        { frequency: 262, duration: 0.16, gain: 0.24, offset: 0.13, type: 'triangle' as OscillatorType },
        { frequency: 523, duration: 0.2, gain: 0.28, offset: 0.28, type: 'triangle' as OscillatorType },
      ];
  }
}
