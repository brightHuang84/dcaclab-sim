# Circuit Lab · 电路实验室 (DCACLab-style simulator) — v7

**English:** Circuit Lab is a self-contained, offline circuit simulator that runs in your browser: drag parts onto the board, wire them up and press Run. It covers DC/AC sources, passive parts, semiconductors, logic, regulators, sensors, protection devices, driver/display modules, a multimeter and a 2-channel oscilloscope, plus 42 ready-made examples. Just open `index.html`, or use the hosted GitHub Pages site. **The UI is available in 10 languages** (简体中文, 繁體中文, English, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (Brasil)). Pick one from the 🌐 menu in the top bar.

> 中文：本项目是一个离线运行的浏览器电路仿真器，界面支持 10 种语言，可在顶栏右侧的 🌐 菜单切换。

This is a self-contained circuit simulator that runs in the browser, inspired by DCACLab. It is written in plain HTML, CSS and JavaScript (classic `<script>` tags). There is no build step, no CDN and no network access. The whole UI is localised (see Languages below).

## Run
- **Double-click `index.html`.** It works from `file://` in Chrome, Edge and Firefox. Or:
- Serve the folder with `python3 -m http.server 8765` and open http://127.0.0.1:8765/.
- URL options:
  - `?example=<id>&run=1` loads an example and starts it.
  - `?fresh=1` skips the autosave.
- Example ids: `ohm, series, parallel, rc, led, fuse, dimmer, acdiode, rlc, scope, scopesq, npn, zener, ne555, breadboard, opinv, opnoninv, comparator, halfadder, clockblink, counter, lissajous, fft, relay, motor, xfmr, sensors, boost, reg7805, lm317, rgbmix, opto, scr, buckaa`; **v7:** `movsurge, tl431, nightlight, l298n, relaymod, hallreed, lcd1602, buzzers`.

## Languages / 多语言 (i18n)
- **Locales:** `zh-CN` (source), `zh-TW`, `en`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-BR`. Every user-facing string is translated: the toolbar, palette categories and part names, properties (labels, units, options), live readings, status bar, toasts and warnings (including convergence messages), help tips, advanced settings, the analysis table, multimeter modes, and example names and descriptions. Part numbers (7805, LM317, NE555, …) and SI units are kept as is. English subtitles appear only in the Chinese locales.
- **Choosing a language:**
  - `?lang=xx` in the URL (e.g. `?lang=ja`) is used for that page load only and is not saved.
  - Otherwise, the choice made in the 🌐 dropdown is used. It is saved in `localStorage` (`dcaclab-lang`).
  - Otherwise, the first supported entry of `navigator.languages` is used (`zh-HK`/`zh-Hant` → `zh-TW`, `pt-*` → `pt-BR`, …).
  - Otherwise, the UI falls back to English.
- **What changes:** `<html lang>`, the document title and the meta description follow the language. Switching re-renders the UI at once and keeps the circuit and a running simulation.
- **Saved circuits are language-neutral.** The saved and exported JSON holds type ids and numeric/enum values only, so a circuit saved in one language opens unchanged in any other.
- **How it works:** translations are plain JS files, so `file://` still works and there is no fetch or build step.
  - `js/i18n.js` provides `I18N` and the alias `_t(key, params)`. Placeholders look like `{name}`. The fallback chain is: chosen locale → `en` → `zh-CN` → the key itself.
  - `js/locales/<code>.js` holds the strings for each locale, registered with `I18N.add(code, {...})`.
  - Static HTML uses `data-i18n` and `data-i18n-title` attributes.
- **Adding a language:**
  1. Copy `js/locales/en.js` to `js/locales/<code>.js` and translate the values. Keep the keys, any HTML tags and the `{placeholders}`.
  2. Add `<code>` with its native name to `I18N.LANGS` in `js/i18n.js`.
  3. Add a `<script src="js/locales/<code>.js">` tag to `index.html`.
  4. Run `tests/test9.js`. It reports missing or extra keys.

## Components
| Category | Parts |
|---|---|
| Sources 电源 | Battery (with internal resistance); AC source (sine, square or triangle, with DC offset and phase); **v6:** AA battery holder (1–4 cells, alkaline / NiMH / weak), coin cell (CR2032 / CR2025 / CR1220 / LR44, 15 Ω), 18650 Li-ion (SOC slider, OCV curve, drains), solar panel (light slider), bench DC power supply (CV/CC) |
| Passive 基本元件 | Resistor, variable resistor, potentiometer, capacitor, inductor; transformer; **v6:** electrolytic capacitor (polarised, warns and pops when reversed or over-voltage), ceramic capacitor (shows the 3-digit code, e.g. 104) |
| Lights / outputs 灯与输出 | Bulb, LED (7 colours, burns out above its max current); buzzer; DC motor; **v6:** RGB LED (common cathode or anode, colour mixing), bi-colour red/green LED, single 7-segment digit driven by its segment pins (CC/CA), 10-segment LED bar graph, SG90 servo (angle from pulse width), 12 V cooling fan, vibration motor |
| Semiconductors 半导体 | Diode; Zener diode; NPN and PNP BJT (with Early effect); N-MOSFET; P-MOSFET; N-JFET; 555 timer; op-amp; **v6:** Schottky 1N5819, rectifier 1N4007, signal 1N4148, bridge rectifier (DB107 / KBP307), TIP120 Darlington, PC817 optocoupler, SCR BT151 and TRIAC BT136 (latching); **part-number presets** for diode / NPN / PNP / MOSFET / op-amp |
| Logic 数字逻辑 (new) | **AND, OR, NOT, NAND, NOR, XOR**; **logic switch**; **clock**; **logic probe**; **D flip-flop**; **7-segment hex display** |
| Regulators & modules 稳压与电源模块 | DC-DC boost module (MT3608-style, v5); **v6:** 78xx fixed regulator (7805 / 7809 / 7812 / 7815 / 7833 / AMS1117-3.3 / -5.0), LM317 adjustable regulator, DC-DC buck module (LM2596-style) |
| Sensors 传感器 (v7) | Photoresistor (LDR, light slider) and NTC thermistor (moved here from Passive); **v7:** Hall sensor (A3144 latch-type switch with hysteresis, or 49E linear 2.5 V ± 1.4 mV/G; magnet slider / click), reed switch (pull-in / drop-out hysteresis; click = magnet), phototransistor (light slider, 2 mA/1000 lx, saturates) |
| Protection 电路保护 (v7) | Fuse (moved here); **v7:** varistor / MOV (07D220K, 10D390K, 10D471K, 14D471K, 14D681K; V₁mA and α; absorbed-energy model, fails short above E_max), TVS diode (SMBJ5.0A / 12A / 24A, bidirectional SMBJ5.0CA / P6KE15CA; V_BR / V_C), resettable fuse PPTC (MF-R010 / R050 / R110 / R250; I_hold, I_trip, thermal trip and automatic reset) |
| Drivers & displays 驱动与显示模块 (v7) | TL431 shunt reference (REF/A/K, 2.495 V, 1 mA minimum cathode current), LM393 dual open-collector comparator (8-pin DIP, real pinout), active crystal oscillator (VCC/GND/OUT, 50 % square wave at the set frequency), active buzzer (DC → 2.3 kHz tone, polarised), passive buzzer (16 Ω + L, sounds at the drive frequency), 1-channel relay module (VCC/GND/IN, NO/COM/NC; high- or low-level trigger, opto input, 8 ms pull-in / 4 ms release), 4×4 membrane keypad (click a key to short its row and column), LCD1602 (16-pin header, contrast from VDD−V0, backlight via on-board 100 Ω, text set by properties with `{V}`/`{t}` tokens), L298N dual H-bridge module (OUT1–4, +12 V, GND, +5 V, ENA/IN1–IN4/ENB with jumpers, ≈2 V saturation drop, flyback diodes, on-board 5 V regulator) |
| Switches 开关 | Switch, push button; relay (SPDT); **v6:** 4-pin tactile button, SPDT slide switch, DPDT toggle switch, 1P4T rotary switch, 4-way DIP switch |
| Meters 仪表 | Ammeter, voltmeter; multimeter with COM / VΩ / 10A jacks; 2-channel oscilloscope (**Y-T, X-Y and FFT modes**) |
| Other 其他 | Breadboard (20, 30 or 40 columns); ground; wire |

## Usage
- **Parts:** drag parts from the palette, or click one to drop it at the centre. R rotates, Del deletes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Y undo and redo, Space runs or pauses.
- **Wires:**
  - Drag from a gold terminal to draw a wire. Wires snap to terminals, wire ends, breadboard holes, points on other wires, and the grid.
  - **Junctions:** drop a wire end on the middle of another wire and that wire is split at a junction dot. **Shift+drag**, or drag in wire mode (W), from the body of a wire to start a branch from it.
  - **Multi-bend wires:** select a wire to show its square vertex handles, then drag them. Drag a segment to move it sideways. **Double-click** a wire to add a vertex, and double-click a vertex to remove it. "重置为直角" resets the wire to a single L-shape.
- **Breadboard:**
  - Part terminals and wire ends snap into holes.
  - Each 5-hole column strip (a–e, f–j) is connected internally, and the centre gap isolates the two halves. Each of the four power rails (+ / −, top and bottom) is connected along its whole row.
  - Hovering a hole highlights every hole connected to it.
  - Moving the board carries the parts and wire ends plugged into it.
- **Oscilloscope:**
  - CH1, CH2 and GND jacks. Time/div (0.1 ms – 1 s), volts/div per channel, vertical position, and CH2 on/off.
  - Trigger modes: rising edge at auto level, rising edge at 0 V, or roll.
  - The trace is drawn live on the instrument. Selecting the scope also shows a large screen in the properties panel. Both show Vpp and frequency.
  - **显示模式 Mode:** *Y-T* (normal); *X-Y* (CH1 = X, CH2 = Y, e.g. Lissajous figures, using the same V/div and position knobs); *FFT* (spectrum of CH1 and CH2).
  - **FFT:** uses a 4096-sample ring buffer (sample rate = 30 / (time/div)), a Hann window, and zero-padding to a power of two. The scale is 10 dB/div with +20 dBV at the top. The frequency range can be set to fs/2, fs/4 … fs/40. It shows the peak frequency (parabolic interpolation) and amplitude. The amplitude is estimated from main-lobe energy, so it has no scalloping loss: a 5 V square wave reads 6.378 V at 100 Hz against 4/π·5 = 6.366 V in theory.
  - **Rotating the scope keeps the screen upright.** In a 90° or 270° slot the 10×8 graticule is scaled to fit.
- **Op-amp:** the terminals are − (top), + (bottom) and OUT. The properties are the saturation voltages V+sat and V−sat (for example ±12 V, or 0…9 V for a single-supply comparator), open-loop gain A, GBW (0 = ideal), slew rate, and output current limit. The readings show Vout, Iout, V+ − V−, and the state (linear / +sat / −sat / current limit).
- **Logic:**
  - Every logic part has a Vdd property (default 5 V). Inputs are 1 MΩ to ground, with Schmitt thresholds at 0.6·Vdd for high and 0.4·Vdd for low. Outputs are 25 Ω push-pull drivers to Vdd or 0 V, so they can drive LEDs, relays, the analogue parts and the scope. This makes the circuits mixed-signal.
  - The **logic switch** toggles when you click it. The **clock** has frequency and duty-cycle settings. The **probe** shows H, L or X.
  - The **D flip-flop** (D, CLK, Q, Q̄) latches on the rising edge.
  - The **7-segment display** decodes four input bits into a hex digit (0–F).
- **Relay:** coil terminals 1 and 2 (an R + L coil); contacts COM, NO and NC. Pull-in and drop-out currents give hysteresis. The contacts are ideal connections.
- **Motor:** armature resistance R, back-EMF constant k, inertia J, and friction b. The readings show rpm, current, back-EMF and torque.
- **LDR / NTC:** use the slider in the properties panel, or the mouse wheel over the part. The LDR uses logarithmic interpolation between R_dark and R_light. The NTC uses R = R25·e^{B(1/T − 1/298.15)} over −20 … 100 °C.
- **Transformer:** a coupled-inductor model. The properties are turns ratio n = Np/Ns, primary inductance, coupling k and winding resistance. The windings are galvanically isolated, and each winding gets its own reference.
- **Buzzer:** a resistive load that sounds above V_on. The sound (Web Audio) is off by default.
- **Wire passing over a terminal (new):**
  - If you draw a wire (or drag its end, vertex or segment) so that a segment runs *exactly* over a terminal or another wire's end, it is **joined automatically**. The toast shows "已自动连接 N 处".
  - Moving, rotating or dropping a part so that its pin lands on a wire body also joins it.
  - A wire that would cross **two pins of the same part** (it would short the part), or one that is already attached to that part, is **not** joined. Any remaining overlap is marked with an **orange dashed ring**, and pressing **J** connects all of them.
- **Multimeter (v4: measures without power and without running):**
  - COM is the common jack. **VΩ→|** is used for volts, ohms, continuity and diode test (10 MΩ input in V ranges, the meter's own 1 mA test current otherwise). **A** is a 0 Ω shunt with an internal 10 A fuse.
  - The knob cycles through **V= · V~ · A= · A~ · Ω · •)) continuity · →| diode**. The same 7 modes are in the 档位 drop-down in the properties panel.
  - **Readings update instantly on every edit**, including placing parts, wiring, changing values, flipping switches and turning the knob. This works while the simulation is **stopped, paused, or has no power at all**. A separate static solve (`js/meters.js`) runs on shadow copies of the parts, so the running or paused simulation state is never touched:
    - *Stopped / never run:* DC operating point. Capacitors are open, inductors and transformer windings are their DC resistance, and sources are taken at t = 0. For example, a meter across a 9 V battery reads **9.000 V** before ▶ is pressed, and the A= range reads the loop current (9 V / 1 kΩ = 9.000 mA).
    - *Paused after running:* a "hold" solve. Capacitors keep their voltage and inductors keep their current, so the reading is the circuit's state at the moment of the pause, even after you rewire.
    - *Running:* the live simulation value, as before.
    - AC ranges read 0 when the circuit has no time-varying source. Otherwise they need a run to measure RMS, and show `----` until then.
  - **Ω (like a real meter):** the meter injects its own 1 mA test current. It solves once with the current on and once with it off, and computes R = ΔV / I (the internal shunt is compensated).
    - A loose 470 Ω resistor reads 470.0 Ω, and 1 k ‖ 1 k reads 500.0 Ω. Series and parallel networks, switches and breadboard strips all work.
    - Open circuit shows **OL** (≥ 20 MΩ). A short reads 0.000 Ω.
    - A bulb reads its cold filament resistance. A capacitor reads OL at DC; while the simulation is running it visibly "charges up" (the reading rises towards OL). An inductor reads its winding resistance (DCR).
    - If the network under test is **powered** (a voltage is present with the test current off), the LCD is outlined in red and shows ⚠. The panel and tooltip say **"测量电阻时请断开电源！被测电路带电，读数不可靠"**, and the reading is shown but flagged as unreliable.
  - **•)) Continuity 通断:** shows the resistance up to 600 Ω, and OL above that. Below **30 Ω** the beeper indicator lights (a yellow glow and ♪ next to the LCD, and "♪ 导通" in the panel). A real beep (Web Audio, 2.3 kHz) is optional: tick "通断档蜂鸣声" in the properties panel. It is off by default.
  - **→| Diode test:** shows the forward voltage at 1 mA. A silicon diode reads 0.655 V. LEDs read their colour's Vf (red ≈ 1.65 V, green ≈ 2.05 V, blue ≈ 2.85 V, white ≈ 2.95 V). Reverse bias or open shows OL (> 3.2 V).
  - If you put the probe in the A jack and measure across a source, the fuse blows, just like on a real meter. The properties panel has a "replace fuse" button.
- **Ammeter / voltmeter:** these also show operating-point readings while stopped or paused, and update on every edit.
- **DC-DC 升压模块 Boost module (v5):**
  - A small blue MT3608-style PCB with an inductor, IC, Schottky diode, capacitors, a **blue trimmer pot** (its slot turns with the setpoint), a red power LED, and the pads **VIN+, VIN− (GND), VOUT+, VOUT− (GND)**. VIN− and VOUT− are the same GND copper, as on the real board. It is in the new **模块 Modules** palette category.
  - **Properties:** output voltage 2–28 V (default 12 V; out-of-range values are rejected), efficiency η (default 90 %), max output current (default 2 A) and minimum input voltage (UVLO, default 2 V). The **mouse wheel over the module** turns the trimmer (±0.1 V per notch).
  - **Readings:** Vin, Iin, Vout, Iout, Pin, Pout, η, setpoint and status. The status is one of 正常 Regulating / 输入过低 UVLO / 输入功率不足 Brown-out / 过流 限流/折返 / 过热保护 / 直通 Pass-through.
  - **Behavioural averaged model** (no switching ripple). It is one nonlinear MNA device on [VIN+, VOUT+, GND], solved by Newton-Raphson with an analytic Jacobian:
    - Regulation: the output is a stiff 2 mΩ Norton source at Vset, so it reads 12.00 V with light or 0.5 A loads.
    - When Vin − 0.4 V > Vset it **passes through** Vin minus the diode drop, like a real boost (smooth max). The boost ratio is limited to 10× (about 90 % max duty).
    - **Power balance:** Iin = Iout·max(Vout/(η·Vin), 1), so Pin = Pout/η and Iin ≥ Iout. For example, 3.7 V in and 12 V / 0.5 A out at 90 % draws 1.80 A. The input current really comes from the source, so a battery's internal resistance makes Vin sag: 3.7 V with 0.3 Ω feeding 6 W sags to 3.04 V and still regulates.
    - **Current limit** (smooth). Under sustained overload the limit folds back towards 40 % as Vout drops. About 3 s of continuous overload trips **thermal shutdown** (a toast, and 🔥 on the board), and the module restarts after cooling.
    - **UVLO:** it turns off below Vmin, with 0.15 V hysteresis and a 20 ms restart delay. If the source cannot supply the demanded power at all (no operating point), the solver's accepted-step hook switches the module off and redoes the step (**brown-out / hiccup**) instead of failing to converge.
    - Newton aids: asymmetric Vin damping (a constant-power input has negative incremental resistance), a knee-crossing clamp on Vout, and a ±3 V step limit.
    - It works with the dense and sparse solvers, the stopped multimeter static solve (a meter across VOUT reads 12.00 V before ▶, and follows setpoint edits), and pause/hold.
- **v6 common parts 常用电子器件:** every new part has a realistic drawing, a properties panel, live readings, and works with the dense and sparse solvers and with the stopped/paused multimeter static solve.
  - **78xx regulator** (TO-220, pins IN · GND · OUT). Pick the part (7805/7809/7812/7815/7833 with 2 V dropout, AMS1117-3.3/5.0 with 1.1 V dropout). Model: Vout = min(Vnom, Vin − Vdropout) with 5 mΩ output resistance, 5 mA quiescent current into GND, a soft current limit (default 1.5 A), no sinking, and a thermal model (Tj = 25 °C + Rθ·Pd with 65 °C/W bare or 8 °C/W with the 散热片 heatsink option; shutdown above 150 °C, restart below 120 °C, so an overloaded bare 7805 cycles on and off). Readings: Vin, Vout, Iout, Iin, Pd, Tj, status (稳压 / 压差不足 dropout / 限流 / 过热).
  - **LM317** (pins ADJ · OUT · IN): holds OUT − ADJ = 1.25 V and sources 50 µA out of ADJ, so Vout = 1.25·(1 + R2/R1) + 50 µA·R2 (240 Ω / 720 Ω → 5.036 V). Dropout 1.7 V.
  - **DC-DC 降压模块 buck module** (LM2596-style blue board, pads IN+ / IN− / OUT+ / OUT−, multi-turn trimmer: mouse wheel ±0.1 V). Same averaged power-balance model as the boost module: Vout = min(Vset, Vin − 1.5 V), Pin = Pout/η, so Iin < Iout (4×AA 5.88 V → 3.3 V 0.30 A draws 0.19 A at 88 %). UVLO, current limit and thermal shutdown as for the boost module.
  - **AA 电池盒 / 纽扣电池 / 18650:** EMF and internal resistance per cell type (alkaline 1.5 V 0.15 Ω, NiMH 1.2 V 0.05 Ω, weak 1.3 V 1 Ω; CR2032 3 V 15 Ω). The 18650 has a Li-ion OCV curve (3.0–4.2 V) over the SOC slider and discharges by coulomb counting (capacity property).
  - **太阳能电池板:** photo-current source (Isc × light) in parallel with a diode sized for Voc and a shunt resistance; light slider / mouse wheel.
  - **直流稳压电源 bench PSU:** V (0–30 V) and I (0–5 A) set points, two 7-segment style displays and CV/CC lamps. It is a CV source with a smooth current limit, so it switches to CC automatically. Mouse wheel over the left half sets V, over the right half sets I; click the OUT button to switch the output on/off.
  - **电解电容:** polarised. Reversed by more than 1 V → toast warning, and after about 0.5 s of stress it **pops** (vented can, becomes open). Above 1.15 × rated voltage it pops too. The readings show 正常 / 极性接反 / 过压 / 已爆裂. The 🔧 更换新的 button in the properties panel replaces it (as for burnt LEDs and bulbs). **瓷片电容** shows the EIA code (104 = 100 nF).
  - **二极管型号:** the diode, NPN, PNP, N-/P-MOSFET and op-amp have a 型号 Part No. drop-down (diode 1N4148 / 1N4007 / 1N5819 / 1N5408, NPN 2N2222 / S8050 / BC547 / 2N3904, PNP 2N2907 / S8550 / BC557 / 2N3906, NMOS 2N7000 / IRF540 / IRLZ44N / AO3400, PMOS IRF9540 / AO3401, op-amp LM358 / TL072 / NE5532 / LM741). Choosing one copies the model parameters (the diode gained a series resistance Rs); "自定义 Custom" keeps your own values. Schottky, rectifier and signal diodes are also separate palette items with their own looks.
  - **整流桥:** four 1N4007-class diodes (with Rs and 100 MΩ leakage), pins + ~ ~ −.
  - **RGB LED** (pins R · common · G · B; common cathode by default, 共阳极 option): Vf 1.9 / 3.0 / 3.1 V; the glow colour is the mix of the three channel currents (the readings show the hex colour and brightness). **双色 LED:** anti-parallel red/green; AC gives yellow/orange.
  - **TIP120:** two BJTs (β 150 × 50) with the internal 8 kΩ / 120 Ω resistors and the C–E flyback diode; Vbe ≈ 1.3 V, β_eff > 1000.
  - **PC817 光耦:** IR LED (Vf ≈ 1.2 V) and phototransistor Ic = CTR·If·tanh(Vce/0.12 V); CTR property (default 100 %). The input and output sides are **galvanically isolated** (each side gets its own reference, like the transformer).
  - **可控硅 SCR (BT151, pins K · A · G) / 双向可控硅 TRIAC (BT136):** the gate is a junction to K; once the gate current exceeds Igt (1 mA / 5 mA) with the anode forward-biased, it **latches on** and stays on after the gate is released, until the anode current falls below the holding current Ih (5 mA) — e.g. open the anode circuit with the NC reset button. The TRIAC does the same in both directions with either gate polarity. The switching is done by the solver's accepted-step hook (the step is redone at the new state).
  - **Switches:** tactile 4-pin button (1–2 and 3–4 are always connected; hold the mouse down to press), SPDT slide switch (click toggles COM→A / COM→B), DPDT toggle (both poles), rotary 1P4T (click = next position, wheel = up/down), DIP ×4 (click on the lever you want).
  - **七段数码管 (单位):** 10 pins in the real layout (g f COM a b / e d COM c dp), common cathode or common anode, each segment an LED (it burns above Imax without resistors). The readings decode the shown digit. **LED 光柱:** 10 independent LEDs (anodes on top, cathodes at the bottom), green/yellow/red or single colour.
  - **舵机 SG90** (brown GND, red VCC, orange SIG): measures the high time of the signal (threshold = half its high level) and maps 1 ms → 0°, 2 ms → 180° (properties), slews at 600 °/s while VCC > 4 V, and draws about 10 mA idle + up to 150 mA while moving. A 50 Hz clock with duty 0.05…0.10 drives it.
  - **散热风扇 12 V:** reverse-protected (series diode) resistive load; the speed follows the voltage (starts at about 30 % of rated voltage) with a 0.8 s spin-up lag. **振动马达:** 3 V 80 mA; the drawing shakes.
- **Touch:** one finger drags parts, wires and the view. Two-finger pinch zooms. The mouse wheel also zooms, and dragging empty space pans.
- **∑ Analysis:** the toolbar button opens a Kirchhoff table. It lists node voltages, the KCL residual for each node, the terminals on each node, and every component's U / I / P. Node names are also drawn on the canvas.
- **Files:** Save/Load uses browser localStorage and Export/Import uses JSON files. The circuit is also autosaved. v1 files (old wire format) still load.

## Engine
- **Modified Nodal Analysis.** Wires, closed switches and breadboard strips are *ideal* connections. They are merged into super-nodes with union-find instead of being stamped as tiny resistors, so ideal circuits read exactly (for example, 9 V / 3 Ω → 3.000 A). This also shrinks the matrix. Wire, strip and switch currents are then reconstructed from KCL, using a pre-factored graph Laplacian per group of connected conductors, so the current animation still works. Ammeters and fuses are 0 V sources, and the ohmmeter compensates for its internal shunt.
- **Solver:**
  - For small circuits it uses dense LU with partial pivoting.
  - At 40 or more unknowns it switches automatically to a **sparse LU**. This uses Markowitz pivot ordering with a threshold of 0.01. The elimination is compiled once into a flat program (fill-in pattern, L and U index arrays), and Newton iterations only redo the numeric pass. If a pivot degrades it re-orders on the fly.
  - Dense and sparse results agree to 1e-15 on the tests.
  - Stress numbers, measured in headless Chrome on the build box (Δt = 200 µs):

    | Circuit | Unknowns | Sparse | Dense | Real-time factor (sparse) |
    |---|---|---|---|---|
    | 200-stage resistor ladder (100 Ω series + 1 kΩ shunt) | 202 | ≈ 185–215 ms per simulated second | ≈ 310 ms | ≈ 5× |
    | 500-stage ladder | 502 | ≈ 450–500 ms | — | ≈ 2× |
    | 100 parallel LED + R branches (nonlinear, 2 Newton iterations per step) | 102 | ≈ 170–180 ms | ≈ 660 ms | ≈ 5.5× |

    For the 200-stage ladder, the rebuild takes about 4 ms and a canvas frame about 8 ms. The battery current matches the analytic ladder value.
- **Time stepping:** trapezoidal companion models for C, L and the coupled windings, with Backward-Euler steps after each topology change. The default Δt is 200 µs.
- **Event localisation (555):**
  - After each step, each part that has an `event` hook (the 555 comparators) reports the fraction θ of the step at which a threshold was crossed, using linear interpolation.
  - The step is then rewound. The solver steps to θ, the flip-flop switches at the exact time, and the rest of the step is completed.
  - Measured on the astable example (theory: t_H = ln2·(R1+R2)·C = 0.35836 s, t_L = 0.33326 s including the 10 Ω discharge transistor):

    | Δt | Event localisation | t_H error | t_L error |
    |---|---|---|---|
    | 200 µs | on | 0.013 % | 0.013 % |
    | 200 µs | off | 0.07 % | 0.04 % |
    | 1 ms | on | 0.014 % | 0.012 % |
    | 1 ms | off | 0.18 % | 0.22 % |
- **Nonlinear devices:** Newton-Raphson with SPICE-style `pnjlim` junction limiting.
  - v6 regulator / PSU models: smooth-min dropout, smooth current limit with a chord slope (Ilim/|Vt − Vout|) while limiting so Newton does not overshoot by Ilim·R_load, a pass-transistor headroom factor (no output current once Vout reaches Vin), and ±1 V steps on Vin − Vref (the dropout corner otherwise makes Newton 2-cycle). The optocoupler damps its Vce steps (max(0.12 V, ½|Vce|)).
  - Diode and LED: Shockley equation.
  - Zener: forward diode plus exponential reverse breakdown at Vz.
  - BJT: transport Ebers-Moll (Is, βF, βR), with NPN and PNP polarity.
  - BJT Early effect: Ic and Ib are scaled by (1 + Vce/VAF). The default VAF is 100 V; 0 turns it off. In the test, Ic rises by 5.9 % from Vce = 2 V to Vce = 8 V.
  - N-MOSFET and P-MOSFET: Shichman-Hodges level 1 (Vth, K, λ).
  - N-JFET: square law with Idss and Vp, plus gate–source and gate–drain junction diodes.
  - Op-amp:
    - Single-pole gain stage: A with a pole at GBW/A, so the closed-loop bandwidth ≈ GBW/(1 + Rf/Rin). It is backward-Euler, so it stays stable at any Δt.
    - The internal swing is set by the slew rate. The gain node is clamped stiffly to the rails, so there is no wind-up and it recovers quickly from saturation.
    - The output is a Norton stage with tanh current limiting.
    - Newton step limiting is applied only in the transition region.
    - Measured gains: inverting −9.998 (ideal −10) and non-inverting 9.998 (ideal 10). The output clips at ±12.01 V.
- **555 timer (behavioural):**
  - An internal 3 × 5 kΩ divider sets the 1/3 and 2/3 thresholds, and the CTRL pin is usable.
  - Comparators drive an SR flip-flop with active-low RESET.
  - Totem-pole output and an open-collector DISCHARGE pin.
  - The measured astable frequency matches 1.44/((R1+2R2)C) to within about 1 %.
- **AC RMS:** meters use AC-coupled true RMS over a window that is a whole number of periods of the slowest AC source (at least 0.2 s). Measured error is below 0.01 % at 0.5 Hz, 1 Hz, 3 Hz, 50 Hz and 1 kHz.

## Convergence (v7)
Users should never have to touch solver settings. v7 reworks the nonlinear solve so that every built-in example, every test fixture and thousands of random circuits converge with the defaults.
- **Convergence test (SPICE-style):** each unknown must satisfy |Δx| < RELTOL·max(|x_new|, |x_old|) + VNTOL (voltages) or ABSTOL (branch currents). RELTOL is now 1e-4, as in SPICE; it was 1e-6 before.
- **KCL residual check:** the step is also accepted when the KCL residual r = A·x − b at every node is below 1e-12 + RELTOL·Σ|terms|. This lets a node that is held only by pA leakage (for example a transformer secondary when every bridge diode is off) converge even when LU round-off makes its voltage jitter by a few µV.
- **Device limiting:** diodes and BJTs use `pnjlim`. MOSFETs now use the real SPICE `fetlim` / `limvds` instead of a fixed clamp. The regulator / PSU chord slopes are secant-based, so they no longer creep slowly in dropout or sink mode.
- **Damping:** when the update stops shrinking after 6 iterations, it is damped (×0.5 / ×0.8). Non-finite values are rejected.
- **Automatic recovery when a step still fails, in order:**
  1. time-step cutting (recursive halving with backward Euler, down to max(minStep, Δt/4096));
  2. gmin stepping (1e-2 → GMIN);
  3. adaptive source stepping.
  If all of these fail, the best approximate solution is used and the simulation keeps running.
- **Friendly, non-blocking warning:**
  - The HUD shows **"⚠ 收敛困难 ×n（已自动处理，近似解继续）"** and a toast (at most every 8 s) lists the remedies that were tried.
  - The components on the worst node are outlined with a red dashed box and a "!" badge for 6 s. Active parts are preferred over passive ones.
  - Nothing is modal, and nothing stops the run.
- **高级仿真设置 Advanced (collapsed in the settings panel):** max iterations, RELTOL, VNTOL, ABSTOL, GMIN, automatic step cutting and minimum step, gmin / source stepping, KCL residual check, and a 恢复默认 reset button.
  - Values are range-checked and saved in localStorage (`dcaclab-simopt`); `?fresh=1` ignores them.
  - The panel also shows statistics for the current run: steps recovered by each method, and steps that did not converge.
- **Fuzz harness (`tests/fuzz.js`):** random rectifier/regulator supplies, random nonlinear graphs (diodes, LEDs, BJTs, MOSFETs, Zeners, op-amps, regulators, SCRs, 555s…) and switching circuits, plus every built-in example and fixture. Run it with `node fuzz.js [count] [seed]`; set `SPARSE=1` or `DENSE=1` to force a solver, or `ONE=family:seed` for a single case.

  | Fuzz run | v6 baseline: non-converged steps / circuits with failures | v7 |
  |---|---|---|
  | 600 random + all examples/fixtures, seed 1 (131 000 steps) | 5639 / 125 | **1 / 1** |
  | same, forced sparse | 4795 / 118 | **1 / 1** |
  | 1000 random, seed 7 | 7411 / 186 | **1 / 1** |

  The seed-1 run is also faster: 2.35 s against 3.25 s. The one remaining failure is a pathological random graph (`graph:3274265001`), and only 1 of its 200 steps fails.
- **User regression (`tests/fixtures/user-7805-supply.json`):**
  - The circuit: 220 V/50 Hz → 1 A fuse → 22:1 transformer → 2 × 0.1 Ω → 1N4007 bridge → 1000 µF + 100 nF + 47 k → 7805 (heatsink and protection diode) → 100 nF → 160 Ω + red LED.
  - On v6, 389 of 5000 steps (≈ 8 %) hit the iteration limit every time the bridge diodes switched off.
  - On v7: 0 failures, Vout = 5.000 V, LED = 20 mA, 7805 Vin ≈ 8.2–8.3 V.

## Examples
**v7:** MOV surge clamp (220 V mains → 100 mH line choke → 14D471K ∥ 40 W bulb; press the button to dump a 1 kV / 220 µF surge through 10 Ω: the MOV clamps at ≈742 V / 15.6 A and absorbs ≈15 J, the bulb survives — delete the MOV and the bulb sees ≈906 V and burns) · TL431 reference 12 V → 4.991 V (R1 = R2 = 10 k) · LM393 + LDR night light (LED on in the dark) · L298N motor forward / reverse / brake with two switches · relay module (low-level trigger) switching a 12 V lamp · Hall A3144 and reed switch LEDs · LCD1602 "Hello, DCACLab!" with backlight and contrast resistor · active buzzer + 1 kHz crystal oscillator driving a passive buzzer.

Ohm's law · series and parallel bulbs · RC charging · LED + resistor · fuse and short circuit · dimmer (multimeter A jack) · AC half-wave · RLC · scope: RC low-pass (sine) · scope: square wave RC · NPN transistor switch · Zener regulator · 555 astable LED blinker · breadboard LED circuit ·
**v5:** DC-DC boost module: 3.7 V Li-ion (50 mΩ) → MT3608 set to 12 V → 12 V 5 W bulb, with a voltmeter and ammeter on the input (3.62 V, 1.53 A) and on the output (12.00 V, 416.6 mA), η = 90 %.
**v6:** 7805 regulator 9 V → 5.000 V into 100 Ω with 330 nF / 100 µF capacitors and two voltmeters · LM317 adjustable supply 12 V → 5.036 V (240 Ω + 2 kΩ pot as R2, turn the pot to change Vout) · RGB LED colour mixing with three pots · PC817 optocoupler isolating a 5 V switch circuit from a 9 V LED circuit · SCR latch (trigger button → LED stays on, NC reset button turns it off) · 4×AA battery holder + LM2596 buck → 3.3 V bulb with meters on the input and output.
**v3:** op-amp inverting ×(−10) · op-amp non-inverting ×10 · op-amp comparator night-light (LDR vs potentiometer, 0…9 V rails, LED) · logic half adder (XOR + AND, two switches, two probes) · 2 Hz clock blinker + NOT gate · 4-bit D-flip-flop ripple counter → 7-segment display · scope X-Y Lissajous 1:2 · scope FFT of a square wave and its RC-filtered version · relay switching two bulbs (NO / NC, flyback diode) · DC motor with rheostat and ammeter · transformer 2:1 + bridge rectifier + 470 µF filter (≈ 6.9 V DC) · NTC and LDR divider sensors with voltmeters.

## Tests
`tests/` contains the Playwright scripts used during development. They need `npm i playwright-core`, a Chrome at `/usr/bin/google-chrome`, and the folder served on port 8765. The older suites run the page with `locale: 'zh-CN'`.
- `test9.js` runs the **i18n checks** (87). It covers:
  - every locale has exactly the zh-CN key set, with no empty values and the same placeholders and tags; the fallback chain works;
  - for each locale: `?lang`, `<html lang>`, the title, the meta description and the dropdown;
  - a DOM scan of the toolbar, the examples menu, the palette, the status bar, the properties panel of every part type, wire properties, the HUD, the analysis table, toasts and readings. The scan checks for raw keys, for Chinese characters in non-Chinese locales, and for Simplified-only characters in `ja` and `zh-TW`;
  - one example runs per locale, and all 42 examples run in every non-Chinese locale without Chinese text appearing;
  - auto-detection from `navigator.languages`, persistence, `?lang` precedence, and rejection of an invalid `?lang`;
  - live switching keeps the circuit and the running simulation; saved JSON is language-independent; `file://` works.
- `shots8.js` makes screenshots 44–47 (en, ja, es, and the language menu).
- `test8.js` runs **62 v7 checks** (also with `SPARSE=1`). It covers:
  - the user's 7805 supply: 0 failed steps, 5 V, LED 20 mA, fuse intact, sane ripple; v6 settings reproduce the failure; the KCL check alone fixes it, and so does RELTOL alone;
  - a starved Newton solve recovers automatically; the warning toast, HUD and highlight; the advanced panel (edit, range rejection, reset, persistence);
  - a fuzz smoke run;
  - every new part: MOV clamp, energy, fail-short; TVS uni/bi; PPTC trip / hold / reset; TL431 2.495 V and formula; LM393 open collector and 20 mV resolution; crystal frequency; active and passive buzzers; Hall switch hysteresis and 49E linear; reed hysteresis; phototransistor; relay module high/low trigger and timing; keypad matrix; LCD1602 contrast, backlight and text tokens; L298N forward / reverse / brake / enable / 5 V regulator;
  - static-meter readings on new parts; dense = sparse;
  - the behaviour of every v7 example;
  - palette, save / reload / draw / rotate, text-property editing, all examples running clean, and no page errors.
- `fuzz.js` is the convergence fuzz harness (see Convergence). `shots7.js` makes screenshots 36–43.
- `test7.js` runs **86 v6 common-part checks**: 7805 5.00 V from 9 V, ≈4.0 V dropout at 6 V, 7.2 V still regulates, 7812 / 7833 / AMS1117, quiescent current, current limit, thermal shutdown cycling without a heatsink and none with it; LM317 formula (5.036 V and 10.08 V), 1.25 V minimum and 5.3 V dropout; AA holder (alkaline, NiMH, sag), CR2032 internal resistance, LR44, 18650 OCV and drain; solar Voc / Isc / light; PSU CV, CC and off; buck 4×AA → 3.3 V, Pin = Pout/η at 88 % and 80 %, Iin < Iout, dropout, no-load and UVLO; electrolytic normal / reversed warning / reversed pop (open) / over-voltage pop, ceramic RC and codes; 1N4148 0.69 V at 10 mA, 1N4007 0.91 V at 1 A, 1N5819 0.42 V at 1 A (driven by the PSU in CC mode), generic diode with preset, bridge DC both polarities and AC full-wave with filter; selecting presets through the properties panel; RGB red / yellow / white / blue / common-anode magenta, bi-colour polarity; TIP120 β > 1000; PC817 CTR 100 % and 200 %, saturation, off state, Vf; SCR off → gate → latched → unlatched by removing anode current, holding current, reverse blocking, TRIAC negative latching; SPDT, tactile, DPDT, rotary and DIP switches; 7-segment "7", "2" and common-anode "8", bar graph; servo 0° / 180° / mid / slew + current; fan speed and reverse protection; vibration motor; the multimeter reads the 7805 output with the simulation stopped (and its dropout after an edit), the LM317 and opto examples statically; dense = sparse; the SCR example sequence; all 34 examples run without warnings; palette entries; save/reload and drawing of all 30 new parts at all rotations; no page errors. It also passes with `SPARSE=1`. `shots6.js` makes screenshots 30–35.
- `test6.js` runs **24 v5 boost-module checks**: Vout within 0.1 % at light load (and at 5.5 V); 3.7 V → 12 V 0.5 A at 90 % draws 1.80 A; Pin = Pout/η at 90 % and 80 %; over-current limit, foldback, 1 A limit and thermal shutdown; Vin < Vmin is off; Vin > Vout passes through (14.6 V from 15 V); weak-battery sag, brown-out without convergence failures, no-load, UVLO hysteresis; the multimeter reads Vout stopped, after setpoint edits and when paused; a stopped ammeter reads 1.80 A in; dense = sparse; the properties panel, range rejection and the mouse wheel on the trimmer; the example runs; the palette category. It also passes with `SPARSE=1`. `shots5.js` makes screenshot 29.
- `test5.js` runs **30 v4 meter checks** with the simulation stopped:
  - loose 470 Ω reads "470.0 Ω"; 1 k ‖ 1 k reads 500 Ω; 1 k + 2.2 k reads 3.200 kΩ; open probes read OL; a short reads 0.000
  - capacitor OL, inductor DCR, bulb cold resistance, open/closed switch
  - continuity beeps on a wire and on 10 Ω, but not on 100 Ω or open
  - diode forward 0.6–0.7 V, reverse OL, LED Vf ordered by colour
  - battery reads 9.000 V both stopped and paused; 8.999 V across an open switch (10 MΩ meter + bulb); A= 9 mA; standalone voltmeter and ammeter (60.00 mA)
  - RC: DC operating point when stopped vs hold value when paused; V~ without an AC source reads 0
  - Ω on a powered circuit shows the 测量电阻时请断开电源 warning
  - the knob cycles all 7 modes; the properties drop-down; automatic recompute in the frame loop after an edit; the capacitor "charges up" while running; no page errors

  It also passes with `SPARSE=1`. `shots4.js` makes screenshots 24–28.
- `test4.js` runs **43 v3 checks**:
  - op-amp gains, rail clipping and comparator; all six gate truth tables, the half adder, the DFF counter (0…15 and wrap-around), 7-segment decoding and the clock blinker
  - PMOS and JFET switching; the Early effect
  - scope X-Y ranges, FFT peaks and square-wave odd harmonics (1, 1/3, 1/5); all scope modes at all rotations
  - **auto-join with a real mouse drag**, auto-join of a moved part, and the orange marker plus J
  - sparse vs dense agreement (linear and nonlinear), and 200-, 500- and 100-LED stress timings
  - 555 event-localisation accuracy (on vs off, at two Δt values)
  - relay pull-in and release, motor torque balance, transformer ratio, bridge output, LDR and NTC resistance, and the buzzer threshold
  - the readings panel, palette thumbnails, a 0.3 s run of all 27 examples with no warnings, v1-format save loading, `file://`, clicking a logic switch, and dragging the LDR slider

  `SPARSE=1` forces the sparse solver for every circuit.
- `test3.js` runs 48 v2 feature checks. It also passes with `SPARSE=1` (forced sparse) and `NOEVENT=1` (no event localisation).
- `test.js` and `test2.js` are the v1 regression suites.

## Known limitations
- Logic gates are behavioural and ground-referenced (no supply pins; Vdd is a property). Outputs update at the end of each time step, so each gate adds one Δt (200 µs) of propagation delay. The clock edges are quantised to Δt. There are no tri-state or open-collector outputs, and no JK/T flip-flops or counter ICs.
- The op-amp has ideal inputs (no bias current or offset) and its rails are properties rather than supply pins, so it draws no supply current. The only dynamics are one pole and the slew rate.
- Relay contacts do not bounce. The transformer is linear (no core saturation or hysteresis). The motor has no load-torque input. The buzzer's sound is optional and off by default.
- Event localisation covers the 555 thresholds only. Other switching (logic, relay pull-in, fuse) still happens at step granularity. There is no general adaptive time step.
- The sparse solver keeps the UI real-time up to roughly 500 unknowns on a typical PC. The canvas draws every part, so thousands of parts will slow rendering.
- When rotating a part makes its wires reroute across other pins, those pins are not auto-joined; they are marked in orange instead. Crossings of two wire bodies are never connections, as in DCACLab.
- Rotated ammeters and voltmeters show a narrow LCD, so readings are easier to read unrotated.
- The boost module is an averaged model: no switching ripple, inductor current or start-up soft-start waveform. Efficiency is a constant, not a function of load. Reverse current into VOUT is blocked except for a 2 % leak.
- v6 parts: the servo reads the pulse width from sampled edges, so an ideal step source (e.g. the clock) is quantised to Δt = 0.2 ms (≈ 36° per step; a 1.5 ms pulse from the clock is really 1.6 ms in the simulation). Regulators and the buck module are behavioural (no ripple, PSRR, load-transient or start-up waveforms); the buck efficiency is constant. The PSU and batteries have no sense of overload damage. The electrolytic capacitor has no ESR, and a popped one stays open until you press 🔧 更换新的. The optocoupler and thyristors have no switching delays or dV/dt triggering. The fan is a resistor + diode with a lagged speed, not an electromechanical model. (v7 adds the crystal oscillator, keypad, 16×2 LCD and reed switch.)
- v7 convergence: the current fuzz run (343 circuits, 73 000 steps) has 0 non-converged steps. Earlier runs had one pathological random graph that failed 1 step; if a step does fail, the run continues with the approximate solution. Time-step cutting is used only to recover a failed step; there is still no general adaptive time step driven by local truncation error.
- v7 parts:
  - **Crystal oscillator:** above the Nyquist rate (f > 1/(2Δt) = 2.5 kHz at the default Δt) it outputs the box-filtered average (≈ VCC/2) instead of individual edges. It is an active (canned) oscillator; a passive crystal resonator is not modelled.
  - **LCD1602:** the text comes from the line1/line2 properties (as if a microcontroller had already initialised it); the HD44780 bus (RS / E / D0–D7) is not emulated.
  - **L298N and the relay module:** logic decisions and contact changes take effect one Δt later.
  - **MOV / TVS:** a surge has to last longer than a few Δt to be resolved (the example uses τ ≈ 2 ms); µs-scale 8/20 pulses are averaged by the 200 µs step. A failed MOV stays shorted until it is replaced.
  - **PPTC:** a lumped thermal model with a fixed ambient.
  - **Hall sensors:** take the field from a slider, not from a magnet position.
- Static meter solve:
  - The ohmmeter's test source is an ideal 1 mA current source with no compliance limit, whereas real meters clamp at about 3 V. Measuring a live circuit shows a warning instead of modelling meter damage.
  - The stopped DC operating point uses t = 0 for time-varying sources, and treats logic, 555 and relay state as it currently is (initial state before a run).
  - AC ranges need a run to measure RMS.
  - Ω mode on a charged capacitor in a paused circuit ignores the stored charge (Ω is always a DC solve).
