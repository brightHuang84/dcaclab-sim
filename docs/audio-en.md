# Audio: speakers and power amplifiers — reference

Generated from the part data and from simulator measurements (`node tools/gen-audio-docs.js`): part table, pin tables, gain / power table, example list and limits.

## How the sound is produced

- The 🔇 / 🔊 toolbar button is the global mute switch and is **muted by default**; click it once to enable sound (browsers need a user gesture), the slider is the master volume. Pausing or resetting the simulation silences everything at once.
- Speakers / headphones / piezo discs / buzzers **do not play a recording**: on every simulation step the voltage across them is fed to an FFT analyser (Hann window, parabolic peak interpolation, ≈ 1.5 Hz resolution) which finds the strongest spectral components (up to 6) and the noise floor; a WebAudio oscillator bank synthesises them live. The pitch and the harmonic content you hear therefore follow the circuit; the timbre is an approximation.
- **Exact**: the main frequency (below the Nyquist limit, error < 1 %), presence / relative size of harmonics and distortion, whether there is a signal at all, left / right channels.
- **Approximate**: loudness (the voltage amplitude is mapped through a compressive curve, rated power = full scale), timbre (only the strongest 6 sine partials are rebuilt), no loudspeaker frequency response / cabinet / room acoustics, no real phase.
- The default time step 0.2 ms means a 5 kHz sample rate, so tones up to about 2 kHz are exact (higher single tones fold back; the analyser un-folds them using the harmonic relation where it can). The audio examples set a finer step themselves (e.g. 50 µs); the analyser decimates internally to ≈ 6 kHz so the practical limit is about 3 kHz. Reduce the "time step" to see higher frequencies.
- `AUD.renderOffline` renders any spectrum through an offline WebAudio context into samples; the test suite uses it to prove that "sound" is non-silent at the right frequency.

## Parts

| Part | Kind | Description |
|---|---|---|
| Speaker (`speaker`) | transducer | 4/8/16 Ω voice coil with DCR, inductance, power rating, SPL readout and burn-out |
| Headphones (32 Ω stereo) (`headphone`) | transducer | Stereo headphones / earbuds: two 32 Ω coils with a common return |
| Piezo disc (buzzer element) (`piezo`) | transducer | Capacitive piezo element (≈20 nF + ESR); sounds with the applied AC voltage |
| Electret microphone (`emic`) | transducer | Two-terminal capsule with internal JFET: bias through a resistor, built-in sound source |
| Audio transformer (1 kΩ : 8 Ω) (`audiotx`) | transducer | Output / interstage audio transformer, ratio 11:1, Lp 5 H, built on the transformer model |
| Audio signal generator (`audiogen`) | source | Sine / triangle / square / saw / sweep / noise / two-tone source with DC offset and 50 Ω / 600 Ω / 10 kΩ output impedance |
| 3.5 mm audio jack (signal source) (`jack35`) | source | TRS jack acting like a phone / line output: Tip = left, Ring = right, Sleeve = ground, with a built-in signal source |
| LM386 audio power amplifier (`lm386`) | amplifier | DIP-8 low-voltage power amp: gain 20 (200 with a capacitor between pins 1 and 8), 4–12 V (N-4: 5–18 V), ≈0.7 W |
| TDA2030 / TDA2030A power amplifier (`tda2030`) | amplifier | Pentawatt-5 class-AB power amp, 6–36 V (A: 44 V), 14 W (A: 18 W) into 4 Ω, 3.5 A current limit, thermal shutdown |
| LM3886 power amplifier (68 W) (`lm3886`) | amplifier | TO-220-11 (TF) class-AB amp: ±10…±42 V, 68 W into 4 Ω at ±28 V, mute pin, 11.5 A peak |
| TDA7297 dual BTL amplifier (`tda7297`) | amplifier | Multiwatt-15 dual bridge amp 2×15 W, 6.5–18 V single supply, fixed gain 32 dB, stand-by and mute pins |
| PAM8403 class-D module (2×3 W) (`pam8403`) | amplifier | Stereo filterless class-D, 2.5–5.5 V (USB 5 V), 3 W per channel into 4 Ω, 24 dB gain, volume pot, mute / shutdown pins |
| PAM8610 class-D module (2×10 W) (`pam8610`) | amplifier | Stereo class-D, 7–15 V supply, 10 W per channel into 8 Ω at 13 V, DC volume, mute (high) / shutdown (low) |
| TPA3116 class-D module (2×50 W) (`tpa3116`) | amplifier | Stereo class-D, 4.5–26 V supply, 50 W per channel into 4 Ω at 21 V, gain 20/26/32/36 dB, mute (high) / SDZ (low) |

(`pot`: the potentiometer has a new "A (audio / log)" taper option for volume controls.)

## Amplifier gain and output power (measured in the simulator)

Measured by `tools/audio-measure.js` inside the simulator: 1 kHz sine, the recommended circuits (LM386 with a 250 µF output capacitor, TDA2030 / LM3886 as non-inverting amplifiers). "Clip-onset power" is the mean load power when the clipping state first appears; "maximum" is the saturated power when the input is increased further.

| Configuration | Voltage gain | Gain dB | Supply | Load | Clip-onset power | Max (saturated) power | Efficiency (clip-onset) |
|---|---|---|---|---|---|---|---|
| LM386N-3, gain 20 | 19.8× | 25.9 | 9 V | 8 Ω | 0.786 W | 1.09 W | 55 % |
| LM386N-3, gain 200 (10 µF 1–8) | 186.7× | 45.4 | 9 V | 8 Ω | 0.776 W | 1.10 W | 55 % |
| TDA2030, ±15 V, gain 11 | 11.0× | 20.8 | 30 V | 8 Ω | 8.90 W | 12.3 W | 51 % |
| TDA2030, ±14 V, 4 Ω, gain 11 | 11.0× | 20.8 | 28 V | 4 Ω | 9.17 W | 12.7 W | 41 % |
| LM3886, ±28 V, 4 Ω, gain 21 | 21.0× | 26.4 | 56 V | 4 Ω | 46.8 W | 66.0 W | 48 % |
| PAM8403, 5 V, 4 Ω | 15.7× | 23.9 | 5 V | 4 Ω | 1.44 W | 2.28 W | 79 % |
| PAM8403, 5 V, 8 Ω | 15.7× | 23.9 | 5 V | 8 Ω | 1.16 W | 1.68 W | 78 % |
| PAM8610, 12 V, 8 Ω | 15.7× | 23.9 | 12 V | 8 Ω | 7.10 W | 9.96 W | 80 % |
| TPA3116, 21 V, 4 Ω, gain 26 dB | 19.7× | 25.9 | 21 V | 4 Ω | 27.4 W | 42.2 W | 84 % |
| TDA7297, 12 V, 8 Ω (BTL) | 33.2× | 30.4 | 12 V | 8 Ω | 4.14 W | 6.13 W | 45 % |

## Speaker

4/8/16 Ω voice coil with DCR, inductance, power rating, SPL readout and burn-out

**Pins**

| Pin | Name |
|---|---|
| 1 | + |
| 2 | − |

**Properties**

| Property | Default |
|---|---|
| Rated impedance | 8 |
| Rated power (W) | 3 |
| Voice-coil inductance (H) | 0.0005 |
| Sensitivity (1 W / 1 m) (dB) | 88 |
| Pan (-1 left … +1 right) | 0 |

## Headphones (32 Ω stereo)

Stereo headphones / earbuds: two 32 Ω coils with a common return

**Pins**

| Pin | Name |
|---|---|
| 1 | L |
| 2 | R |
| 3 | ⏚ |

**Properties**

| Property | Default |
|---|---|
| Rated impedance | 32 |
| Rated power (per channel) (W) | 0.05 |
| Voice-coil inductance (H) | 0.0001 |
| Sensitivity (1 mW) (dB) | 100 |

## Piezo disc (buzzer element)

Capacitive piezo element (≈20 nF + ESR); sounds with the applied AC voltage

**Pins**

| Pin | Name |
|---|---|
| 1 | + |
| 2 | − |

**Properties**

| Property | Default |
|---|---|
| Capacitance (F) | 2e-8 |
| Series resistance (ESR) (Ω) | 60 |
| Resonant frequency (Hz) | 4000 |
| Maximum voltage (V) | 30 |

## Electret microphone

Two-terminal capsule with internal JFET: bias through a resistor, built-in sound source

**Pins**

| Pin | Name |
|---|---|
| 1 | + (OUT) |
| 2 | − (GND) |

**Properties**

| Property | Default |
|---|---|
| Bias current (at 2.2 kΩ) (A) | 0.0005 |
| Sensitivity (dBV/Pa, 2.2 kΩ) (dB) | -44 |
| Sound input on | true |
| Sound source waveform | sine |
| Sound pressure level (94 dB = 1 Pa) (dB) | 74 |
| Sound source frequency (Hz) | 1000 |

## Audio transformer (1 kΩ : 8 Ω)

Output / interstage audio transformer, ratio 11:1, Lp 5 H, built on the transformer model

**Pins**

| Pin | Name |
|---|---|
| 1 | P1 ● |
| 2 | P2 |
| 3 | S1 ● |
| 4 | S2 |

**Properties**

| Property | Default |
|---|---|
| Turns ratio Np:Ns (:1) | 11 |
| Primary inductance (H) | 5 |
| Coupling coefficient k | 0.995 |
| Winding resistance (Ω) | 0.5 |

## Audio signal generator

Sine / triangle / square / saw / sweep / noise / two-tone source with DC offset and 50 Ω / 600 Ω / 10 kΩ output impedance

**Pins**

| Pin | Name |
|---|---|
| 1 | OUT |
| 2 | ⏚ |

**Properties**

| Property | Default |
|---|---|
| Waveform | sine |
| Amplitude (peak-to-peak) (V) | 1 |
| Frequency (sweep start) (Hz) | 1000 |
| Second frequency / sweep end (Hz) | 1500 |
| Sweep period (s) | 2 |
| DC offset (V) | 0 |
| Source impedance | 600 |

## 3.5 mm audio jack (signal source)

TRS jack acting like a phone / line output: Tip = left, Ring = right, Sleeve = ground, with a built-in signal source

**Pins**

| Pin | Name |
|---|---|
| 1 | T (L) |
| 2 | R (R) |
| 3 | S (⏚) |

**Properties**

| Property | Default |
|---|---|
| Output signal | true |
| Waveform | sine |
| Amplitude (peak-to-peak) (V) | 1 |
| Left channel frequency (Hz) | 440 |
| Right channel frequency (0 = same as left) (Hz) | 0 |
| Second frequency / sweep end (Hz) | 660 |
| Source impedance | 100 |

## LM386 audio power amplifier

DIP-8 low-voltage power amp: gain 20 (200 with a capacitor between pins 1 and 8), 4–12 V (N-4: 5–18 V), ≈0.7 W

**Pins**

| Pin | Name |
|---|---|
| 1 | GAIN |
| 2 | −IN |
| 3 | +IN |
| 4 | GND |
| 5 | VOUT |
| 6 | VS |
| 7 | BYPASS |
| 8 | GAIN |

**Properties**

| Property | Default |
|---|---|
| Variant | N-3 |
| Thermal resistance (junction to ambient) (°C/W) | 80 |

```
LM386 DIP-8 (top view)
1 GAIN  8 GAIN
2 −IN   7 BYPASS
3 +IN   6 VS
4 GND   5 VOUT

Gain 20 (26 dB); capacitor 1–8 → 200 (46 dB); R+C in series 1–8 → 20…200.
Supply 4–12 V (N-4: 5–18 V). Output must be AC-coupled (≥ 220 µF) to the speaker.
```

## TDA2030 / TDA2030A power amplifier

Pentawatt-5 class-AB power amp, 6–36 V (A: 44 V), 14 W (A: 18 W) into 4 Ω, 3.5 A current limit, thermal shutdown

**Pins**

| Pin | Name |
|---|---|
| 1 | +IN |
| 2 | −IN |
| 3 | −Vs |
| 4 | OUT |
| 5 | +Vs |

**Properties**

| Property | Default |
|---|---|
| Variant | TDA2030 |
| Thermal resistance (junction to ambient, with heat sink) (°C/W) | 4 |

```
TDA2030(A) Pentawatt (front view)
1 +IN  (non-inverting)
2 −IN  (inverting)
3 −Vs  (GND for single supply)
4 OUT
5 +Vs

Non-inverting gain  G = 1 + R2/R1  (R1 from −IN to ground through a capacitor, R2 from OUT to −IN).
Supply 6–36 V (A: up to 44 V). Peak current 3.5 A. Thermal shutdown ≈150 °C.
```

## LM3886 power amplifier (68 W)

TO-220-11 (TF) class-AB amp: ±10…±42 V, 68 W into 4 Ω at ±28 V, mute pin, 11.5 A peak

**Pins**

| Pin | Name |
|---|---|
| 1 | NC |
| 2 | V+ |
| 3 | OUT |
| 4 | V+ |
| 5 | NC |
| 6 | V− |
| 7 | GND |
| 8 | MUTE |
| 9 | −IN |
| 10 | +IN |
| 11 | NC |

**Properties**

| Property | Default |
|---|---|
| Thermal resistance (junction to ambient, with heat sink) (°C/W) | 1.5 |

```
LM3886TF (TO-220-11, front view)
1 NC   2 V+   3 OUT   4 V+   5 NC   6 V−
7 GND  8 MUTE  9 −IN  10 +IN  11 NC

MUTE (pin 8): open = muted; to un-mute let ≥ 0.5 mA flow into the pin, i.e. a resistor R from MUTE to GND with R ≈ (|V−| − 2.6 V)/0.5 mA or less (22 kΩ at ±20 V).
Supply |V+|+|V−| = 20…84 V (UVLO at 12 V). Non-inverting gain G = 1 + Rf/Ri (≥ 10 recommended).
```

## TDA7297 dual BTL amplifier

Multiwatt-15 dual bridge amp 2×15 W, 6.5–18 V single supply, fixed gain 32 dB, stand-by and mute pins

**Pins**

| Pin | Name |
|---|---|
| 1 | OUT1+ |
| 2 | OUT1− |
| 3 | VCC |
| 4 | IN1 |
| 5 | NC |
| 6 | MUTE |
| 7 | ST-BY |
| 8 | PW-GND |
| 9 | S-GND |
| 10 | NC |
| 11 | NC |
| 12 | IN2 |
| 13 | VCC |
| 14 | OUT2− |
| 15 | OUT2+ |

**Properties**

| Property | Default |
|---|---|
| Thermal resistance (junction to ambient, with heat sink) (°C/W) | 3 |

```
TDA7297 Multiwatt-15 (front view)
1 OUT1+  2 OUT1−  3 VCC  4 IN1  5 NC  6 MUTE  7 ST-BY  8 PW-GND
9 S-GND  10 NC  11 NC  12 IN2  13 VCC  14 OUT2−  15 OUT2+

Fixed gain 32 dB (40×, bridge). ST-BY and MUTE need > 3.3 V (tie to VCC through a divider / delay RC) — both low or open = stand-by.
Use input coupling capacitors (0.22 µF): IN is biased at Vref = Vcc/2.
```

## PAM8403 class-D module (2×3 W)

Stereo filterless class-D, 2.5–5.5 V (USB 5 V), 3 W per channel into 4 Ω, 24 dB gain, volume pot, mute / shutdown pins

**Pins**

| Pin | Name |
|---|---|
| 1 | IN-L |
| 2 | IN-R |
| 3 | GND |
| 4 | VCC |
| 5 | MUTE |
| 6 | SD |
| 7 | L+ |
| 8 | L− |
| 9 | R+ |
| 10 | R− |

**Properties**

| Property | Default |
|---|---|
| Volume pot (logarithmic) | 1 |
| Thermal resistance (junction to ambient) (°C/W) | 60 |

```
PAM8403 module (stereo class-D, averaged model)
IN-L, IN-R, GND, VCC (2.5–5.5 V; USB 5 V), MUTE (low = mute, floats high), SD (low = shutdown, floats high), L+ L− R+ R− (BTL outputs, connect the speaker between + and −).
Differential gain 24 dB (15.8×) × volume pot. 3.2 W / 4 Ω and 1.8 W / 8 Ω (THD 10 %) at 5 V.
```

## PAM8610 class-D module (2×10 W)

Stereo class-D, 7–15 V supply, 10 W per channel into 8 Ω at 13 V, DC volume, mute (high) / shutdown (low)

**Pins**

| Pin | Name |
|---|---|
| 1 | IN-L |
| 2 | IN-R |
| 3 | GND |
| 4 | VCC |
| 5 | MUTE |
| 6 | SD |
| 7 | L+ |
| 8 | L− |
| 9 | R+ |
| 10 | R− |

**Properties**

| Property | Default |
|---|---|
| Volume pot (logarithmic) | 1 |
| Thermal resistance (junction to ambient) (°C/W) | 25 |

```
PAM8610 module (stereo class-D, averaged model)
IN-L, IN-R, GND, VCC (7–15 V, abs. max 16.5 V), MUTE (HIGH = mute), SD (LOW = shutdown), L+ L− R+ R−.
10 W per channel into 8 Ω at 13 V (THD 10 %). Gain here: 24 dB × volume pot (module gain is DC-volume controlled; approximation).
```

## TPA3116 class-D module (2×50 W)

Stereo class-D, 4.5–26 V supply, 50 W per channel into 4 Ω at 21 V, gain 20/26/32/36 dB, mute (high) / SDZ (low)

**Pins**

| Pin | Name |
|---|---|
| 1 | IN-L |
| 2 | IN-R |
| 3 | GND |
| 4 | VCC |
| 5 | MUTE |
| 6 | SD |
| 7 | L+ |
| 8 | L− |
| 9 | R+ |
| 10 | R− |

**Properties**

| Property | Default |
|---|---|
| Gain (GAIN/SLV pin) | 26 |
| Volume pot (logarithmic) | 1 |
| Thermal resistance (junction to ambient) (°C/W) | 8 |

```
TPA3116D2 module (stereo class-D, averaged model)
IN-L, IN-R, GND, VCC (4.5–26 V), MUTE (HIGH = mute), SD = SDZ (LOW = shutdown), L+ L− R+ R−.
2×50 W into 4 Ω at 21 V (THD 10 %). Gain 20 / 26 / 32 / 36 dB selected by the GAIN/SLV resistor divider (latched at power-up on the real chip).
```

## Examples

| Example | What it shows |
|---|---|
| Audio: LM386 amplifier driving an 8 Ω speaker (gain 20) | Generator → 10 µF → LM386 (gain 20) → 250 µF → 8 Ω speaker; the scope shows the input and the 20× larger output. |
| Audio: LM386 gain 200 (switch the pin 1–8 capacitor) | A 10 µF capacitor between pins 1 and 8 switches to gain 200; the input is only 20 mVpp. |
| Audio: 555 square wave + speaker (click the switch to change pitch) | A 555 astable drives the speaker through a capacitor; the switch changes the pitch (audible, and shown as "main frequency" in the panel). |
| Audio: Arduino tone() melody → coupling capacitor + volume pot → speaker | An Arduino plays a melody with tone(); 100 Ω → 47 µF coupling capacitor → audio-taper volume pot → speaker. |
| Audio: PAM8403 stereo class-D (3.5 mm jack → two speakers, mute switch) | 3.5 mm jack with 440 Hz (left) / 660 Hz (right) → PAM8403 module → two speakers; a switch pulls MUTE low. |
| Audio: 555 driving a piezo disc (passive buzzer) | A 555 square wave drives a piezo disc as a passive buzzer (a capacitive load). |
| Audio: electret mic → LM358 preamp → LM386 → speaker | Electret mic (74 dB SPL sound source) → LM358 amplifier → LM386 → speaker: a complete microphone amplifier chain. |
| Audio: clipping demo — LM386 gain 200 overdriven (scope + FFT harmonics) | LM386 at gain 200 is over-driven: the output is flattened by the rails, the scope FFT shows odd harmonics and the amplifier state reads "clipping". |
| Audio: 2-way crossover — first-order LC with woofer / tweeter (scope on each branch) | First-order LC crossover: inductor + woofer, capacitor + tweeter; with a swept source scope CH1 shows the woofer branch (low-pass) and CH2 the tweeter branch (high-pass). |
| Audio: push-pull (class-AB) transistor amplifier (switch shorts the diodes → crossover distortion) | Complementary push-pull (class AB) transistor amplifier; a switch shorts the bias diodes → crossover distortion and its harmonics. |
| Audio: LM358 preamp → TDA2030 power amp (single 12 V supply) | LM358 preamp → TDA2030 single-supply power amplifier (12 V) driving a 4 Ω speaker. |

## Limits and notes

- The amplifiers are averaged / behavioural models: linear gain + rail clipping + drop-out + output current limit + thermal model; no switching ripple (class D uses an averaged model that gives efficiency and supply current), no crossover distortion (except in the transistor example), no detailed noise / PSRR.
- Power is electrical power around 1 kHz (mean of V·I); the SPL readout is an estimate of the 1 m sound pressure from the sensitivity (dB/W/m), not an acoustic simulation.
- Speaker electrical model: DC resistance + voice-coil inductance; there is no mechanical resonance (impedance peak). Burn-out uses a thermal integrator: the longer the overload, the sooner it fails.
- The electret microphone "sound source" is an internal signal (sine / square / sweep / noise / two-tone); it does not capture the computer's microphone. The 3.5 mm jack and the generator are the same (no WAV-file input).
- Not represented: acoustic phase of cabinets / crossovers, feedback howl, real music.

_(generated from the part data — do not edit by hand)_
