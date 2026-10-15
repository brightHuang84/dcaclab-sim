# 🎲 现实模拟 / Real-world simulation mode (v15)

By default the simulator solves an **ideal** circuit: a 9 V battery gives exactly 9.000 V and every reading is perfectly stable.
The **🎲 现实模拟** toolbar button adds the small imperfections of real hardware. **⚙** next to it opens the settings.

* **Off by default.** When it is off, the simulator is bit-for-bit identical to v14.1. Every hook passes straight through.
* The state is kept in `localStorage` (`dcl.real`): on/off, intensity, the effect checkboxes, ripple and seed.
* All randomness is **deterministic**: it is a hash of (seed, component id, quantity, time bucket).
  * The same circuit gives the same "real" values every run.
  * **🎲 Re-roll tolerances** picks a new seed, which is like grabbing other parts from the drawer.
* Saved circuits never contain real-mode data. Nominal property values are not changed.

## Intensity

| level | R tol. | C / L tol. | noise scale | bounce | wire R | discharge speed-up |
|---|---|---|---|---|---|---|
| Low | ±1 % | ±10 % | ×0.4 | ≈0.6 ms | ≈10 mΩ | ×10 |
| Medium (default) | ±5 % | ±20 % | ×1 | ≈2 ms | ≈30 mΩ | ×60 |
| High | ±10 % | ±20 % | ×2.5 | ≈5 ms | ≈100 mΩ | ×600 |

## Effects (each can be switched off in ⚙)

| effect | model |
|---|---|
| Component tolerances | Resistor, rheostat and pot R; capacitor C; inductor L. Each is a seeded value inside the band, e.g. 1 kΩ → 1.032 kΩ. The properties panel shows nominal → actual. |
| Battery | Internal resistance V/6 (9 V ≈ 1.5 Ω), so the voltage sags under load. Battery packs also slowly discharge: the output drops up to 15 %, accelerated so you can see it. |
| Supply ripple | The bench PSU output gets a sine of *N* mV at 50 / 60 / 100 / 120 Hz. The default is 50 mV at 100 Hz, as from a full-wave rectified adapter. |
| Source noise | ≈1 mV of white noise on batteries, AC sources and the PSU. |
| ADC noise | `analogRead()` jitters by about ±1 LSB (σ = 0.7 LSB × level). |
| Self-heating drift | Resistors, LEDs and transistors warm up: thermal resistance × power, τ ≈ 1.5 s. R gets +300 ppm/°C. Diode and BJT Is rises (about −2 mV/°C) and β gets +0.4 %/°C. The properties panel shows the temperature. |
| Wire resistance | Every wire becomes a few-mΩ resistor instead of an ideal short. Wire currents are still shown. |
| Contact bounce | Switch, push button and tactile switch: on every actuation the contact chatters for a few ms. An Arduino counting presses without debouncing will over-count. |
| Sensor noise | Sensor readings get ±0.4 % of span per 20 ms. |
| Meter flicker | Multimeter, voltmeter and ammeter readings flicker in the last digit, about every 0.3 s. |
| Scope noise | Oscilloscope traces get a little noise, scaled to V/div. |

Thermal (Johnson-like) noise is added as a tiny noise current across each resistor. It is part of "Source noise".

## Examples

* **现实模拟：电源纹波与 RC 滤波**
  * Circuit: a 12 V PSU → 100 Ω → 470 µF ‖ 1 kΩ.
  * The scope is AC-coupled at 20 mV/div: CH1 shows the PSU ripple, CH2 shows the filtered rail.
  * Turn 🎲 on to see the ripple.
* **现实模拟：按钮抖动与单片机计数**
  * Circuit: an Arduino counts button presses on D2 without debouncing.
  * Ideal mode counts 1 per press. With 🎲, bounce makes the count jump.
  * Compare it with the `arddebounce` example.

## Limits

* These are teaching-level models, not datasheet-accurate ones.
* Discharge is time-accelerated.
* Noise is white and per time step, so it has no 1/f component.
* Temperature affects only the listed parts.
