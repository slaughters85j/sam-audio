export interface EffectDef {
  id: string;
  name: string;
  category: string;
  description: string;
  build: (ctx: AudioContext, intensity: number) => EffectChain;
}

export interface EffectChain {
  input: AudioNode;
  output: AudioNode;
}

function generateImpulse(
  ctx: AudioContext,
  duration: number,
  decay: number
): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * decay);
    }
  }
  return impulse;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 44100;
  const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function wetDry(
  ctx: AudioContext,
  intensity: number,
  effectNode: AudioNode,
  effectOutput?: AudioNode
): EffectChain {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const t = intensity / 100;
  dry.gain.value = 1 - t;
  wet.gain.value = t;
  input.connect(dry);
  dry.connect(output);
  input.connect(effectNode);
  (effectOutput || effectNode).connect(wet);
  wet.connect(output);
  return { input, output };
}

const effects: EffectDef[] = [
  // ── Basic Effects ─────────────────────────────────────────────────────
  {
    id: "reverb",
    name: "Reverb",
    category: "Basic Effects",
    description: "Add natural room reverberation",
    build: (ctx, intensity) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, 2.0, 3.0);
      return wetDry(ctx, intensity, convolver);
    },
  },
  {
    id: "delay",
    name: "Delay",
    category: "Basic Effects",
    description: "Echo with feedback",
    build: (ctx, intensity) => {
      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.4;
      const out = ctx.createGain();
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(out);
      return wetDry(ctx, intensity, delay, out);
    },
  },
  {
    id: "equalizer",
    name: "Equalizer",
    category: "Basic Effects",
    description: "3-band EQ adjustment",
    build: (ctx, intensity) => {
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 320;
      low.gain.value = (intensity - 50) * 0.24;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 0.5;
      mid.gain.value = (intensity - 50) * 0.2;
      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 3200;
      high.gain.value = (intensity - 50) * 0.24;
      low.connect(mid);
      mid.connect(high);
      return { input: low, output: high };
    },
  },
  {
    id: "compressor",
    name: "Compressor",
    category: "Basic Effects",
    description: "Dynamic range compression",
    build: (ctx, intensity) => {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -50 + (intensity / 100) * 30;
      comp.ratio.value = 4 + (intensity / 100) * 16;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      return { input: comp, output: comp };
    },
  },

  // ── Vocal Enhancers ───────────────────────────────────────────────────
  {
    id: "studio-sound",
    name: "Studio Sound",
    category: "Vocal Enhancers",
    description: "Clean studio-quality vocal processing",
    build: (ctx, intensity) => {
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 80;
      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3000;
      presence.Q.value = 1.0;
      presence.gain.value = (intensity / 100) * 6;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 3;
      high.connect(presence);
      presence.connect(comp);
      return { input: high, output: comp };
    },
  },
  {
    id: "vocal-presence",
    name: "Vocal Presence",
    category: "Vocal Enhancers",
    description: "Boost vocal clarity and presence",
    build: (ctx, intensity) => {
      const f = ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = 3500;
      f.Q.value = 1.5;
      f.gain.value = (intensity / 100) * 10;
      return { input: f, output: f };
    },
  },
  {
    id: "broadcast-ready",
    name: "Broadcast Ready",
    category: "Vocal Enhancers",
    description: "Radio/podcast-ready processing chain",
    build: (ctx, intensity) => {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 100;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 6;
      comp.attack.value = 0.001;
      comp.release.value = 0.1;
      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 4000;
      presence.Q.value = 0.8;
      presence.gain.value = (intensity / 100) * 5;
      hp.connect(comp);
      comp.connect(presence);
      return { input: hp, output: presence };
    },
  },

  // ── Spatial Effects ───────────────────────────────────────────────────
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    category: "Spatial Effects",
    description: "Short reflective echoes",
    build: (ctx, intensity) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, 0.8, 5.0);
      return wetDry(ctx, intensity, convolver);
    },
  },
  {
    id: "concert-hall",
    name: "Concert Hall",
    category: "Spatial Effects",
    description: "Large hall reverberation",
    build: (ctx, intensity) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, 3.0, 2.0);
      return wetDry(ctx, intensity, convolver);
    },
  },
  {
    id: "underwater",
    name: "Underwater",
    category: "Spatial Effects",
    description: "Muffled underwater sound",
    build: (ctx, intensity) => {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500 + (1 - intensity / 100) * 2000;
      lp.Q.value = 1.0;
      return wetDry(ctx, intensity, lp);
    },
  },
  {
    id: "cave",
    name: "Cave",
    category: "Spatial Effects",
    description: "Deep cavernous reverberation",
    build: (ctx, intensity) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, 5.0, 1.5);
      return wetDry(ctx, intensity, convolver);
    },
  },

  // ── Fun Effects ───────────────────────────────────────────────────────
  {
    id: "bass-boost",
    name: "Bass Boost",
    category: "Fun Effects",
    description: "Heavy bass enhancement",
    build: (ctx, intensity) => {
      const f = ctx.createBiquadFilter();
      f.type = "lowshelf";
      f.frequency.value = 100;
      f.gain.value = (intensity / 100) * 18;
      return { input: f, output: f };
    },
  },
  {
    id: "bright-treble",
    name: "Bright Treble",
    category: "Fun Effects",
    description: "Sparkling high frequencies",
    build: (ctx, intensity) => {
      const f = ctx.createBiquadFilter();
      f.type = "highshelf";
      f.frequency.value = 4000;
      f.gain.value = (intensity / 100) * 12;
      return { input: f, output: f };
    },
  },
  {
    id: "lo-fi",
    name: "Lo-Fi",
    category: "Fun Effects",
    description: "Vintage low-fidelity sound",
    build: (ctx, intensity) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1000;
      bp.Q.value = 0.5 + (intensity / 100) * 2;
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(intensity * 2);
      bp.connect(ws);
      return wetDry(ctx, intensity, bp, ws);
    },
  },
  {
    id: "telephone",
    name: "Telephone",
    category: "Fun Effects",
    description: "Old telephone speaker simulation",
    build: (ctx, intensity) => {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 300;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3400;
      hp.connect(lp);
      return wetDry(ctx, intensity, hp, lp);
    },
  },
  {
    id: "punch",
    name: "Punch",
    category: "Fun Effects",
    description: "Add punch and impact",
    build: (ctx, intensity) => {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -30;
      comp.ratio.value = 10;
      comp.attack.value = 0.001;
      comp.release.value = 0.05;
      const boost = ctx.createBiquadFilter();
      boost.type = "peaking";
      boost.frequency.value = 150;
      boost.Q.value = 1.0;
      boost.gain.value = (intensity / 100) * 10;
      comp.connect(boost);
      return { input: comp, output: boost };
    },
  },
  {
    id: "robot-voice",
    name: "Robot Voice",
    category: "Fun Effects",
    description: "Metallic robotic modulation",
    build: (ctx, intensity) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.frequency.value = 30 + (intensity / 100) * 50;
      osc.type = "sine";
      const modGain = ctx.createGain();
      modGain.gain.value = 0.5 + (intensity / 100) * 0.5;
      osc.connect(modGain);
      modGain.connect(input.gain);
      osc.start();
      input.connect(output);
      return wetDry(ctx, intensity, input, output);
    },
  },
  {
    id: "classic-80s-robot",
    name: "Classic 80s Robot",
    category: "Fun Effects",
    description: "Retro robot voice effect",
    build: (ctx, intensity) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.frequency.value = 100 + (intensity / 100) * 100;
      osc.type = "square";
      const modGain = ctx.createGain();
      modGain.gain.value = 0.3 + (intensity / 100) * 0.4;
      osc.connect(modGain);
      modGain.connect(input.gain);
      osc.start();
      input.connect(output);
      return wetDry(ctx, intensity, input, output);
    },
  },
  {
    id: "harmonizing-robot",
    name: "Harmonizing Robot",
    category: "Fun Effects",
    description: "Harmonic robotic overtones",
    build: (ctx, intensity) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.frequency.value = 200 + (intensity / 100) * 200;
      osc.type = "sawtooth";
      const modGain = ctx.createGain();
      modGain.gain.value = 0.2 + (intensity / 100) * 0.3;
      osc.connect(modGain);
      modGain.connect(input.gain);
      osc.start();
      input.connect(output);
      return wetDry(ctx, intensity, input, output);
    },
  },
  {
    id: "glitchy-ai",
    name: "Glitchy AI",
    category: "Fun Effects",
    description: "Digital glitch artifacts",
    build: (ctx, intensity) => {
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(intensity * 5);
      ws.oversample = "4x";
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2000;
      bp.Q.value = 2;
      ws.connect(bp);
      return wetDry(ctx, intensity, ws, bp);
    },
  },
  {
    id: "twinkle-robot",
    name: "Twinkle Robot",
    category: "Fun Effects",
    description: "Sparkly robotic shimmer",
    build: (ctx, intensity) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.frequency.value = 400 + (intensity / 100) * 400;
      osc.type = "sine";
      const modGain = ctx.createGain();
      modGain.gain.value = 0.15 + (intensity / 100) * 0.2;
      osc.connect(modGain);
      modGain.connect(input.gain);
      osc.start();
      const hs = ctx.createBiquadFilter();
      hs.type = "highshelf";
      hs.frequency.value = 6000;
      hs.gain.value = (intensity / 100) * 10;
      input.connect(hs);
      hs.connect(output);
      return wetDry(ctx, intensity, input, output);
    },
  },
  {
    id: "megaphone",
    name: "Megaphone",
    category: "Fun Effects",
    description: "Bullhorn / megaphone sound",
    build: (ctx, intensity) => {
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(intensity);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2000;
      bp.Q.value = 2.0;
      ws.connect(bp);
      return wetDry(ctx, intensity, ws, bp);
    },
  },
  {
    id: "pitch-up",
    name: "Pitch Up",
    category: "Fun Effects",
    description: "Raise the pitch",
    build: (ctx, intensity) => {
      // Pitch effects are handled specially via playbackRate
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "pitch-down",
    name: "Pitch Down",
    category: "Fun Effects",
    description: "Lower the pitch",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "vibrato",
    name: "Vibrato",
    category: "Fun Effects",
    description: "Wavering pitch modulation",
    build: (ctx, intensity) => {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = 0.005;
      const osc = ctx.createOscillator();
      osc.frequency.value = 5 + (intensity / 100) * 10;
      const oscGain = ctx.createGain();
      oscGain.gain.value = (intensity / 100) * 0.004;
      osc.connect(oscGain);
      oscGain.connect(delay.delayTime);
      osc.start();
      return wetDry(ctx, intensity, delay);
    },
  },
  {
    id: "monster",
    name: "Monster",
    category: "Fun Effects",
    description: "Deep monstrous voice",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "fairy",
    name: "Fairy",
    category: "Fun Effects",
    description: "Light magical fairy voice",
    build: (ctx, intensity) => {
      const hs = ctx.createBiquadFilter();
      hs.type = "highshelf";
      hs.frequency.value = 4000;
      hs.gain.value = (intensity / 100) * 8;
      return { input: hs, output: hs };
    },
  },
  {
    id: "chipmunk",
    name: "Chipmunk",
    category: "Fun Effects",
    description: "High-pitched chipmunk voice",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "demon",
    name: "Demon",
    category: "Fun Effects",
    description: "Deep demonic voice",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "giant",
    name: "Giant",
    category: "Fun Effects",
    description: "Booming giant voice",
    build: (ctx, intensity) => {
      const ls = ctx.createBiquadFilter();
      ls.type = "lowshelf";
      ls.frequency.value = 200;
      ls.gain.value = (intensity / 100) * 10;
      return { input: ls, output: ls };
    },
  },
  {
    id: "helium",
    name: "Helium",
    category: "Fun Effects",
    description: "Helium-inhaled high voice",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "alien",
    name: "Alien",
    category: "Fun Effects",
    description: "Otherworldly alien voice",
    build: (ctx, intensity) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.frequency.value = 60 + (intensity / 100) * 40;
      osc.type = "triangle";
      const modGain = ctx.createGain();
      modGain.gain.value = 0.4 + (intensity / 100) * 0.3;
      osc.connect(modGain);
      modGain.connect(input.gain);
      osc.start();
      input.connect(output);
      return wetDry(ctx, intensity, input, output);
    },
  },
  {
    id: "ghost",
    name: "Ghost",
    category: "Fun Effects",
    description: "Eerie ghostly whisper",
    build: (ctx, intensity) => {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, 4.0, 1.0);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 600;
      convolver.connect(hp);
      return wetDry(ctx, intensity, convolver, hp);
    },
  },
  {
    id: "slow-motion",
    name: "Slow Motion",
    category: "Fun Effects",
    description: "Slowed down playback",
    build: (ctx, intensity) => {
      const g = ctx.createGain();
      return { input: g, output: g };
    },
  },
  {
    id: "cartoon-villain",
    name: "Cartoon Villain",
    category: "Fun Effects",
    description: "Over-the-top villain voice",
    build: (ctx, intensity) => {
      const ls = ctx.createBiquadFilter();
      ls.type = "lowshelf";
      ls.frequency.value = 300;
      ls.gain.value = (intensity / 100) * 8;
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(intensity * 0.5);
      ls.connect(ws);
      return wetDry(ctx, intensity, ls, ws);
    },
  },
];

// Effects that change playback rate
export const PITCH_EFFECTS: Record<string, (intensity: number) => number> = {
  "pitch-up": (i) => 1.0 + (i / 100) * 0.5,
  "pitch-down": (i) => 1.0 - (i / 100) * 0.4,
  chipmunk: (i) => 1.5 + (i / 100) * 0.5,
  helium: (i) => 1.8 + (i / 100) * 0.4,
  monster: (i) => 0.6 - (i / 100) * 0.15,
  demon: (i) => 0.5 - (i / 100) * 0.15,
  "slow-motion": (i) => 0.7 - (i / 100) * 0.3,
};

export function getCategories(): string[] {
  const cats: string[] = [];
  for (const e of effects) {
    if (!cats.includes(e.category)) cats.push(e.category);
  }
  return cats;
}

export function getEffectsByCategory(category: string): EffectDef[] {
  return effects.filter((e) => e.category === category);
}

export function getEffectById(id: string): EffectDef | undefined {
  return effects.find((e) => e.id === id);
}

export default effects;
