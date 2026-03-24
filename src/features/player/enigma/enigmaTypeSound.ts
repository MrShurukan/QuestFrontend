/** Short typewriter click via Web Audio (no binary assets). */
export function playEnigmaTypeClick(audioContext: AudioContext) {
  const t = audioContext.currentTime
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1_650 + Math.random() * 500, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028)
  osc.connect(gain)
  gain.connect(audioContext.destination)
  osc.start(t)
  osc.stop(t + 0.03)
}
