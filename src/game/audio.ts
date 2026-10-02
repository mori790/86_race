// Procedural placeholder audio; recorded multi-RPM samples belong to Phase 5.
export class EngineAudio {
  private context: AudioContext | null = null;
  private master?: GainNode;
  private engine?: GainNode;
  private wind?: GainNode;
  private filter?: BiquadFilterNode;
  private oscillators: OscillatorNode[] = [];

  async start() {
    if (!this.context) {
      const context = new AudioContext(); this.context = context;
      this.master = context.createGain(); this.master.gain.value = 0;
      const limiter = context.createDynamicsCompressor();
      this.master.connect(limiter); limiter.connect(context.destination);
      this.engine = context.createGain(); this.engine.gain.value = 0.1;
      this.filter = context.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 400;
      this.engine.connect(this.filter); this.filter.connect(this.master);
      for (const [index, type] of (["sawtooth", "triangle", "sine"] as OscillatorType[]).entries()) {
        const oscillator = context.createOscillator(); oscillator.type = type;
        oscillator.frequency.value = 30 * (index + 1); oscillator.connect(this.engine); oscillator.start();
        this.oscillators.push(oscillator);
      }
      const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 700;
      this.wind = context.createGain(); this.wind.gain.value = 0;
      source.connect(filter); filter.connect(this.wind); this.wind.connect(this.master); source.start();
    }
    await this.context.resume();
  }

  update(rpm: number, speed: number, throttle: number, audible: boolean) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(audible ? 0.35 : 0, now, 0.08);
    this.oscillators.forEach((oscillator, i) => oscillator.frequency.setTargetAtTime(rpm / 30 * (i + 1), now, 0.04));
    this.engine?.gain.setTargetAtTime(0.07 + throttle * 0.06, now, 0.06);
    this.filter?.frequency.setTargetAtTime(180 + rpm * 0.13 + throttle * 300, now, 0.05);
    this.wind?.gain.setTargetAtTime(Math.min(0.22, Math.abs(speed) / 280), now, 0.1);
  }

  dispose() { void this.context?.close(); this.context = null; this.oscillators = []; }
}
