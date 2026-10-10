# Circuit Lab · 电路实验室 (DCACLab-style simulator) — v13

**English:** Circuit Lab is a self-contained, offline circuit simulator that runs in your browser: drag parts onto the board, wire them up and press Run. It covers DC/AC sources, passive parts, semiconductors, logic, regulators, sensors, protection devices, driver/display modules, a multimeter and a 2-channel oscilloscope, plus 95 ready-made examples. Just open `index.html`, or use the hosted GitHub Pages site. **The UI is available in 10 languages** (简体中文, 繁體中文, English, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (Brasil)). Pick one from the 🌐 menu in the top bar. **v9** adds box selection and group editing (move, rotate, copy/paste, delete), selection-only export with a file-name dialog, import as replace or merge, and automatic merging of wire chains. **v10** adds programmable microcontrollers: an Arduino-Uno-style board and an ATtiny85-style 8-pin chip that run your own Arduino-C (or JavaScript) program in simulated time and drive the circuit through their pins, with a built-in code editor and serial monitor. **v10.1** adds an in-app **pinout & usage reference** for both chips (pin map, every pin's functions, electrical limits, what is simulated, common circuits, and 14 one-click examples; also as Markdown in [docs/pinout-zh.md](docs/pinout-zh.md) / [docs/pinout-en.md](docs/pinout-en.md)) and **wire colours**. **v11** adds **25 new sensors** (analog modules, digital modules, and protocol sensors that work with real Arduino libraries: HC-SR04 with `pulseIn`, DHT11/DHT22 with the DHT library, DS18B20 with OneWire + DallasTemperature), an optional **signal source** on every sensed quantity, an **LCD1602 I2C** display (PCF8574 backpack, `LiquidCrystal_I2C` + `Wire`), loud **LCD wiring/contrast diagnostics**, palette search, a sensors section in the reference panel, and 11 new examples. **v12** adds **7 more microcontroller boards** on the same runtime: Arduino Nano, Arduino Mega 2560, Arduino Pro Mini (5 V/16 MHz and 3.3 V/8 MHz), ESP32 DevKit V1, Raspberry Pi Pico, STM32 Blue Pill and a classic 8051 (STC89C52 / AT89C52, programmed in C51), each with its own pin map, power options, reference-panel page and two examples (Blink + one board-specific). **v13** adds **52 logic ICs of the 74-series and CD4000 families** as real DIP packages (datasheet pin-outs, VCC/GND required) with a *logic family* property (74HC / 74HCT / 74LS / 74, fixed CD4000B), live pin states and a function table in the properties panel, a 4-digit multiplexed 7-segment display, 14 new examples (including Arduino `shiftOut` → 74HC595 and `shiftIn` ← 74HC165) and a generated reference ([docs/74-series-en.md](docs/74-series-en.md) / [docs/74-series-zh.md](docs/74-series-zh.md)).

> 中文：本项目是一个离线运行的浏览器电路仿真器，界面支持 10 种语言，可在顶栏右侧的 🌐 菜单切换。v9 新增：选择模式（框选多个器件、整体移动/旋转/复制粘贴/删除）、仅导出选中部分、导出时自定义文件名、导入时可选择替换或合并插入，以及首尾相连的导线自动合并。v10 新增：可编程单片机——Arduino Uno 风格开发板和 ATtiny85 风格 8 脚芯片，用 Arduino C（或 JavaScript）写程序，在仿真时间里运行并通过引脚驱动电路；自带代码编辑器和串口监视器。v10.1 新增：开发板/芯片的「引脚说明与用法」面板（引脚图、每个引脚的功能、电气极限、仿真支持情况、常规用法和 14 个可一键载入的示例；文档版见 [docs/pinout-zh.md](docs/pinout-zh.md)），以及导线颜色选择。v11 新增：25 种传感器（模拟模块、数字模块，以及可用真实 Arduino 库读取的 HC-SR04 / DHT11 / DHT22 / DS18B20），每个被测量都可接一个随时间变化的信号源；LCD1602 I2C 液晶屏（PCF8574 背板，LiquidCrystal_I2C 库）；液晶屏接线、对比度和初始化问题的明确提示；元件搜索；引脚说明面板的“传感器”章节；11 个新示例。v12 新增 7 种常用单片机/开发板：Arduino Nano、Arduino Mega 2560、Arduino Pro Mini（5V/16MHz 与 3.3V/8MHz）、ESP32 DevKit V1、树莓派 Pico、STM32 Blue Pill 和经典 8051（STC89C52 / AT89C52，用 C51 编程），每块板都有引脚图、供电方式、引脚说明页和两个示例（Blink + 一个板子特色示例）。 v13 新增：**52 种 74 系列 / CD4000 逻辑 IC**（真实 DIP 封装与数据手册引脚、必须接 VCC/GND），带“逻辑系列”属性（74HC / 74HCT / 74LS / 74，CD4000B 固定），属性面板里有实时引脚状态和功能表；四位动态扫描数码管；14 个新示例（含 Arduino `shiftOut` → 74HC595、`shiftIn` ← 74HC165）；并由零件数据生成的参考文档（[docs/74-series-zh.md](docs/74-series-zh.md) / [docs/74-series-en.md](docs/74-series-en.md)）。

This is a self-contained circuit simulator that runs in the browser, inspired by DCACLab. It is written in plain HTML, CSS and JavaScript (classic `<script>` tags). There is no build step, no CDN and no network access. The whole UI is localised (see Languages below).

## Run
- **Double-click `index.html`.** It works from `file://` in Chrome, Edge and Firefox. Or:
- Serve the folder with `python3 -m http.server 8765` and open http://127.0.0.1:8765/.
- URL options:
  - `?example=<id>&run=1` loads an example and starts it.
  - `?fresh=1` skips the autosave.
- Example ids: `ohm, series, parallel, rc, led, fuse, dimmer, acdiode, rlc, scope, scopesq, npn, zener, ne555, breadboard, opinv, opnoninv, comparator, halfadder, clockblink, counter, lissajous, fft, relay, motor, xfmr, sensors, boost, reg7805, lm317, rgbmix, opto, scr, buckaa`; **v7:** `movsurge, tl431, nightlight, l298n, relaymod, hallreed, lcd1602, buzzers`; **v10:** `ardblink, ardtraffic, ardbutton, ardpwm, ardservo, ardlcd, tinyblink`; **v10.1:** `arddebounce, ardnight, ardmulti, ardmotor, ardrelay, ardtone, tinyfade`; **v12:** `nanoblink, nanoana, megablink, megabar, pmblink, pmbatt, espblink, espdac, picoblink, picoadc, bpblink, bpadc, c51blink, c51run`. **v13:** `ttlsr, ttlrip, ttlbcd, ttl161, ttl138, ttl595, ttl165, ttl373, ttl245, ttl7483, ttl7485, ttl194, ttl14, ttl7474`.

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

## Selection & group editing (v9) / 选择与整体编辑
- **Select tool** (toolbar *Select* button, shortcut **V**): drag on empty canvas to draw a rubber band.
  - Dragging **left→right** is a *window*: it picks the parts whose outline is fully inside and the wires whose every vertex is inside.
  - Dragging **right→left** is a *crossing* (dashed green): it also picks anything the rectangle touches.
  - Breadboards are only picked when fully enclosed, so you can box-select the parts sitting on a board.
  - A plain click on empty space clears the selection.
- **In normal mode:**
  - Plain drag on empty space still pans.
  - **Shift+drag** or **Ctrl+drag** box-selects (adding to the selection).
  - **Ctrl/Cmd+click** (or Shift+click on a part) adds or removes an item.
  - **Ctrl+A** selects all; **Esc** clears.
  - **Pan** with the middle or right mouse button, or hold **Space** and drag (a Space tap still runs or pauses).
  - **Touch:** long-press (≈0.45 s) then drag to box-select; a quick drag pans.
- **Group actions** (each one is a single undo step):
  - **Move:** drag any selected item and the whole group moves.
    - Wires between selected parts move with them.
    - Wires to unselected parts stretch (their far end stays put, keeping the path orthogonal) and stay connected.
    - A selected breadboard carries every part plugged into it.
    - The circuit's connectivity and readings are unchanged (tested).
  - **Nudge:** arrow keys move the group 1 grid step; Shift+arrow moves 5.
  - **Rotate:** **R** rotates the group 90° around its centre (snapped to the grid).
  - **Copy/paste:** **Ctrl+C / Ctrl+V** copy and paste, **Ctrl+X** cuts, **Ctrl+D** duplicates.
    - The copy includes every wire whose both ends are on copied parts, also through free junctions.
    - The paste is offset and nudged so that no pin lands on an existing connection point; the pasted items become the selection.
  - **Delete:** **Del** removes the selected items and any wires left dangling at both ends.
- **Properties panel:** shows "N items selected" with the part/wire breakdown and the group buttons. When every selected part has the same type, a **bulk editor** changes a property on all of them at once.
- **Export (⬇):** opens a dialog.
  - **Scope:** *Whole circuit* or *Selection only*. The scope defaults to the selection when two or more items are selected.
  - **Selection only:** saves the selected parts plus the wires whose both ends are on them, with positions shifted so the top-left corner is at the origin. The file has `"kind": "selection"`.
  - **File name:** you type the file name; the default is the circuit title or `circuit-YYYYMMDD-HHMM`.
    - Illegal characters `<>:"/\|?*` and control characters become `_`.
    - Leading/trailing dots and spaces are trimmed, Windows reserved names get a `_`, the name is capped at 100 characters, and `.json` is appended once.
    - A live preview shows the final name.
  - **Title:** the name is stored as the circuit `title` (kept in saves, autosave and the exported JSON).
- **Import (⬆):** into an empty canvas the file simply loads. Otherwise a dialog asks:
  - **Replace circuit**, or
  - **Merge / insert**: the file's parts are added at the view centre as a *selected group* that you can drag into place; selection exports default to this.
- **Wire auto-merge:** a point that joins exactly two wire ends and nothing else (no terminal, no breadboard hole, no third wire) is not a real junction.
  - The two wires become one polyline: the point turns into a bend, and collinear vertices are removed.
  - **Wires of different colours are never merged** (v10.1): the joint stays a real two-wire point so each keeps its colour. Same-colour chains merge as before.
  - Merging runs with every edit (drawing, dragging ends/segments, deleting a part or wire, group moves, paste, import) as part of the same undo step, and when any circuit or old save is loaded.
  - T-junctions (3+ wires) and points on terminals are never merged.
  - Dropping a wire end on the middle of a wire still splits it into a junction; deleting that branch later re-merges the two halves.
  - The topology is identical, so simulation results do not change.

## Wire colours (v10.1) / 导线颜色
- Select one or more wires (click, Ctrl/Shift+click or box select). The properties panel shows a **导线颜色 / Wire colour** row: red, black, blue, green, yellow, orange, white, purple, grey, brown, plus a custom colour picker. The current colour is highlighted (none when the selected wires differ).
- A change applies to **all selected wires as one undo step** (Ctrl+Z restores every wire's previous colour).
- **New wires use the last chosen colour**, remembered in `localStorage` (`dcaclab-wirecolor`); `?fresh=1` starts with the default red.
- Colours are stored as `#rrggbb` in saves, autosave, exported JSON (whole circuit and selection) and import/merge. Older files without a colour still load, with the default red.
- Wires of different colours are **not auto-merged** (see *Wire auto-merge*).
- Light colours (white, yellow) get a dark outline, and the current-flow dots switch to a dark colour on light wires, so the current animation stays visible on every colour.
- Tip (common convention): red = +V, black = GND, other colours for signals.

## Sensors (v11) / 传感器
All sensors are in the **传感器 / Sensors** palette category (the palette now also has a **search box**: name in the UI language, English name, type id or description). Every sensor has:
- the **measured quantity** as a property with a slider *and* a number box with units, plus a live **readings** block (quantity, output voltage/level, internal resistance or pulse width where relevant);
- an optional **signal source** (信号源) on the quantity: constant, sine, triangle, square or ramp (sawtooth), between *min* and *max* with a *period*, so the quantity changes with simulated time (e.g. an ultrasonic distance that sweeps 15–250 cm);
- the real module pin names and its own drawing; names, descriptions, properties and readings in all 10 languages;
- save / load like any other part.

| Part | Pins | Key properties / model (5 V supply unless noted) | Read with |
|---|---|---|---|
| Photoresistor module | VCC GND DO AO | 0–10 000 lx; GL5528-class LDR (≈ 15 kΩ at 10 lx) against 10 kΩ; LM393 DO with threshold trimmer | `analogRead` / `digitalRead` |
| MQ gas sensor module | VCC GND DO AO | 0–10 000 ppm; MQ-2 (LPG curve) or MQ-135 (NH₃ curve), Rs/R0 from a simplified log-log curve, R0 and load RL adjustable; heater ≈ 33 Ω (≈ 150 mA) | AO / DO |
| Flame sensor module | VCC GND DO AO | IR intensity 0–100 % (760–1100 nm photodiode); more IR → lower AO | AO / DO |
| Soil moisture sensor | VCC GND DO AO | 0–100 %; probe resistance against 10 kΩ, wetter → lower AO | AO / DO |
| Rain sensor | VCC GND DO AO | 0–100 % water on the plate, wetter → lower AO | AO / DO |
| Thermistor module | VCC GND DO AO | −20–100 °C; 10 kΩ NTC, B = 3950, against 10 kΩ | AO / DO |
| Sound sensor (envelope) | VCC GND DO AO | 30–110 dB; electret + amplifier + envelope; DO high above the threshold | AO / DO |
| TCRT5000 line tracker | VCC GND DO AO | reflectance 0–100 %; white → AO low / DO low, black line → DO high | AO / DO |
| Water level sensor | S + − | immersion 0–40 mm | `analogRead` |
| LM35 | +Vs Vout GND | Vout = 10 mV/°C (25 °C → 250 mV); supply 4–30 V | `analogRead` |
| TMP36 | +Vs Vout GND | Vout = 0.5 V + 10 mV/°C (25 °C → 750 mV), −40…125 °C, 2.7–5.5 V | `analogRead` |
| Flex sensor | 1 2 | ≈ 25 kΩ flat, rising with bend (≈ 125 kΩ at 180°); use in a divider | `analogRead` |
| FSR (force-sensitive resistor) | 1 2 | > 10 MΩ unloaded, R ≈ 10 kΩ / F[N] (min 250 Ω); use in a divider | `analogRead` |
| Joystick module | GND +5V VRx VRy SW | two 10 kΩ pots, centre ≈ VCC/2; SW to GND (needs `INPUT_PULLUP`) | `analogRead` ×2 + `digitalRead` |
| ACS712 current sensor | VCC OUT GND IP+ IP− | OUT = VCC/2 + k·I; k = 185 mV/A (5 A), 100 mV/A (20 A), 66 mV/A (30 A); IP+→IP− is a real isolated 1.2 mΩ path, so it can measure a current in your circuit or a set value | `analogRead` |
| Pressure sensor (analog) | +5V GND OUT | generic 0.5–4.5 V ratiometric; MPX5010DP Vout = Vs·(0.09·P + 0.04); MPX5700AP Vout = Vs·(0.0012858·P + 0.04), P in kPa | `analogRead` |
| HC-SR501 PIR | VCC OUT GND | OUT 3.3 V for Tx (3–300 s), H (retrigger) / L mode, ≈ 2.5 s block time; supply 4.5–20 V; click = someone walks past | `digitalRead` |
| IR obstacle sensor (FC-51 type) | OUT GND VCC | distance 0–100 cm, detection range 2–30 cm (trimmer); OUT low when an obstacle is in range | `digitalRead` |
| Tilt switch SW-520D | 1 2 | ball switch: closed upright, open when tilted | `digitalRead` |
| SW-420 vibration module | VCC GND DO | DO low at rest, high on vibration above the threshold; click = knock | `digitalRead` |
| TTP223 touch module | VCC I/O GND | 2.0–5.5 V; momentary active-high by default, toggle / active-low options (A/B pads); hold = touch | `digitalRead` |
| KY-040 rotary encoder | GND + SW DT CLK | one CLK and one DT pulse per detent, CLK leads clockwise; 10 kΩ pull-ups on CLK/DT, SW to GND; click left/right half = one step, wheel = rotate, or set a continuous spin | `digitalRead` |
| HC-SR04 ultrasonic | VCC Trig Echo GND | 2–400 cm (slider to 450 to test out-of-range); Trig ≥ 10 µs → Echo high for 2·d / c (≈ 58 µs/cm), air temperature sets the speed of sound (331.3 + 0.606·T m/s); ≈ 38 ms when out of range | `pulseIn(echo, HIGH)` |
| DHT11 / DHT22 | VCC DATA GND | temperature and humidity; DHT11 0–50 °C / 20–90 %RH integer values, DHT22 −40–80 °C / 0–100 %RH at 0.1 resolution; at least 2 s between reads | `DHT` library |
| DS18B20 | GND DQ VDD | −55…125 °C, 3.0–5.5 V, 9–12-bit resolution (0.5…0.0625 °C); DQ needs 4.7 kΩ to VDD; 85 °C before the first conversion | `OneWire` + `DallasTemperature` |
| LCD1602 I2C (in 驱动与显示模块) | GND VCC SDA SCL | PCF8574 backpack, address 0x20–0x27 (PCF8574T) or 0x38–0x3F (PCF8574AT), default 0x27; contrast trimmer, backlight jumper; SDA/SCL = A4/A5 on the Uno, PB0/PB2 on the ATtiny85 | `LiquidCrystal_I2C` + `Wire` |

The older sensor parts (LDR, NTC, Hall, reed switch, phototransistor) are unchanged and also live in this category.

**Libraries for sensors (Arduino C mode):**
- `#include <DHT.h>`: `DHT dht(pin, DHT11|DHT22)`, `begin() readTemperature([isF]) readHumidity() computeHeatIndex(t, h[, isF]) convertCtoF convertFtoC`. Reads fail (`NAN`) when the sensor is not powered, DATA is not on that pin or the sensor is read faster than every 2 s (the last value is returned, as in the library); a toast names the pin.
- `#include <OneWire.h>` + `#include <DallasTemperature.h>`: `OneWire ow(pin); DallasTemperature s(&ow);` with `begin() getDeviceCount() requestTemperatures() getTempCByIndex(i) getTempFByIndex(i) setResolution(bits)`. Without a pull-up or without power the read returns `-127` (`DEVICE_DISCONNECTED_C`) and a toast says what is missing.
- `pulseIn()` on the HC-SR04 Echo pin returns the exact echo width (not quantised to Δt).
- `#include <Wire.h>` + `#include <LiquidCrystal_I2C.h>`: `LiquidCrystal_I2C lcd(0x27, 16, 2);` with `init() begin() clear() home() setCursor() print() println() write() backlight() noBacklight() display() noDisplay() cursor() noCursor() blink() noBlink() scrollDisplayLeft/Right() leftToRight() rightToLeft() autoscroll() noAutoscroll() createChar()`; `Wire.begin() beginTransmission() write() endTransmission()` (address scan works; `endTransmission` returns 0 or 2). `Wire.requestFrom()` and other I2C devices are not supported and give a clear error.

## LCD diagnostics (v11) / 液晶屏诊断
Driving the parallel LCD1602 from a board was always simulated (`LiquidCrystal`, 4-bit or 8-bit), but problems were silent. Now the simulator says why the screen stays blank:
- **Wrong pin mapping:** the LCD checks that RS, E and D4–D7 really go to the pins in the `LiquidCrystal lcd(rs, en, d4, d5, d6, d7)` constructor and names the mismatch (e.g. "D7 应接 D2，实际接在 D6"). When D4–D7 go to the right pins in the wrong order it says so (**reversed** or **swapped**), e.g. for D4…D7 wired to D2…D5 while the code says `lcd(12, 11, 5, 4, 3, 2)`: "D4–D7 的顺序与程序正好相反 …", and it suggests the matching constructor (`LiquidCrystal lcd(12, 11, 2, 3, 4, 5);`).
- **No `lcd.begin()`:** nothing is shown, as on hardware, with a hint to call `lcd.begin(16, 2)`.
- **Contrast:** V0 is modelled; the characters fade out as V0 rises (VDD − V0 must be about 3 V or more; best at V0 ≈ 0.3–1 V on a 5 V supply). With the pot in the middle (V0 ≈ 2.5 V) the text is barely visible, and a toast says to turn the pot towards GND. A floating V0 is treated as pulled low.
- **No power / no common ground** is reported; the 6- and 7-argument constructors (the latter with an RW pin) are supported; printing before `begin()` shows nothing, as on hardware, and the toast explains it.
- **I2C module code with a parallel LCD:** `LiquidCrystal_I2C` used to fail with "unknown type"; it is now supported with the new LCD1602 I2C part, and if the code is I2C but the circuit has the parallel LCD (or vice versa), the toast says so. Address mismatch shows **I2C 地址不匹配** with both addresses; swapped SDA/SCL, wrong pins and an unpowered backpack are named as well.

## Pinout & usage reference (v10.1) / 引脚说明与用法
- Open it with **📌 引脚说明 / Pinout** in the program editor's toolbar or in the chip's properties panel. It is a scrollable, draggable, resizable window placed beside the editor, with a toggle between **Arduino Uno** and **ATtiny85**, and follows the UI language (all 10 locales).
- Contents: an SVG **pin map**; a **table of every pin** (functions as coloured tags, notes, and whether the simulator supports it: ✓ / partial / ✗ / pin not on the part, with non-simulated functions dashed); **electrical limits**; **what is simulated**; **usage sections** (digital output and LED resistor, buttons with pull-up/pull-down and debounce, analog input with pot / divider / LDR / NTC, PWM, motors via transistor/MOSFET + flyback diode, relays, tone, servo, LCD1602, Serial, `millis()` multitasking, powering the board); and **examples** at the end, each with description, wiring, code and the buttons **载入到画布** (load and run), **插入编辑器** (put the code into the current chip's editor, not uploaded yet) and **复制代码**.
- Key facts shown (from the ATmega328P / ATtiny85 datasheets and the Uno R3 schematic): Uno PWM on D3/D9/D10/D11 ≈ 490 Hz and D5/D6 ≈ 980 Hz; A0–A5 10-bit ADC (also digital 14–19), A4 = SDA, A5 = SCL; D0 = RX, D1 = TX; external interrupts D2 (INT0) and D3 (INT1); SPI D10 SS, D11 MOSI, D12 MISO, D13 SCK; L LED on D13; 40 mA absolute maximum / 20 mA recommended per pin, 200 mA total; VIN 7–12 V recommended. ATtiny85: DIP-8 order 1 PB5, 2 PB3, 3 PB4, 4 GND, 5 PB0, 6 PB1, 7 PB2, 8 VCC; PWM on PB0/PB1/PB4; ADC0–ADC3 = PB5/PB2/PB4/PB3; USI (DI/SDA = PB0, DO = PB1, USCK/SCL = PB2); PB5 = RESET.
- The same content as Markdown with SVG pin maps: [docs/pinout-zh.md](docs/pinout-zh.md) (中文) and [docs/pinout-en.md](docs/pinout-en.md) (English), generated from the app's own data by `node tools/gen-pinout-docs.js`.

## More boards (v12) / 更多单片机
All seven boards are in the **单片机 Microcontrollers** palette category and use the same runtime, editor, serial monitor, pin electrical model (push-pull output resistance, `INPUT_PULLUP`, thresholds with hysteresis, over-current warning) and brown-out logic as the Uno. The **📌 Pinout** panel has a board switch for all 9 parts (Uno, ATtiny85, Nano, Mega 2560, Pro Mini, ESP32, Pico, Blue Pill, 8051); Markdown versions with SVG pin maps are in [docs/pinout-zh.md](docs/pinout-zh.md) / [docs/pinout-en.md](docs/pinout-en.md).

| Board | Logic / clock | Pins in the program | ADC | PWM (`analogWrite`) | LED_BUILTIN | Power (property) | Examples |
|---|---|---|---|---|---|---|---|
| **Arduino Nano** (ATmega328P) | 5 V, 16 MHz | D0–D13, A0–A7 (A6/A7 analog only) | 10-bit, 0–1023 | D3/D9/D10/D11 490 Hz, D5/D6 980 Hz | D13 | USB 5 V, or VIN → 5 V regulator (7–12 V), or 5V pin | `nanoblink`, `nanoana` |
| **Arduino Mega 2560** (ATmega2560) | 5 V, 16 MHz | D0–D53, A0–A15 | 10-bit | D2–D13 and D44–D46 (D4/D13 980 Hz, others 490 Hz) | D13 | USB 5 V or VIN 7–12 V | `megablink`, `megabar` |
| **Arduino Pro Mini** (ATmega328P) | variant 5 V/16 MHz or 3.3 V/8 MHz | D0–D13, A0–A7 | 10-bit vs VCC | as the Nano | D13 | FTDI header (VCC) or RAW → on-board regulator | `pmblink`, `pmbatt` |
| **ESP32 DevKit V1** (ESP32-WROOM-32) | 3.3 V, 240 MHz, `int` 32-bit | GPIO numbers (GPIO6–11 = SPI flash, not usable; GPIO34–39 input-only, no pulls) | 12-bit 0–4095 (ADC1 32–39, ADC2 unusable with WiFi), `analogReadMilliVolts` | every output pin, 1 kHz; `ledcAttach`/`ledcSetup`/`ledcAttachPin`/`ledcWrite`; DAC `dacWrite` on GPIO25/26 | GPIO2 | USB, VIN 5 V (AMS1117 3.3 V) or 3V3 pin; EN low = reset | `espblink`, `espdac` |
| **Raspberry Pi Pico** (RP2040) | 3.3 V, 133 MHz, `int` 32-bit | GP0–GP28 (GP23/24/25/29 are on-board: SMPS PS, VBUS sense, LED, VSYS÷3) | 10-bit by default, `analogReadResolution(12)`; A0–A2 = GP26–28, A3 = VSYS/3 | every GPIO, 1 kHz; `analogWriteRange`, `analogWriteFreq`, `analogWriteResolution` | GP25 | USB (VBUS) or VSYS 1.8–5.5 V (buck-boost → 3.3 V); RUN low = reset | `picoblink`, `picoadc` |
| **STM32 Blue Pill** (STM32F103C8T6, STM32duino names) | 3.3 V, 72 MHz, `int` 32-bit | `PA0`…`PA15`, `PB0`…`PB15`, `PC13`–`PC15` | 12-bit capable, 10-bit default; PA0–PA7, PB0, PB1 | 16 timer pins, 1 kHz | PC13, **active LOW** | USB or 5V pin (3.3 V regulator) or 3.3 V pin; NRST low = reset | `bpblink`, `bpadc` |
| **8051** (STC89C52RC / AT89C52, DIP-40) | 5 V (brown-out below ≈ 3.5 V), crystal property 6 / 11.0592 / 12 / 22.1184 / 24 MHz | `P0`–`P3` and `sbit X = P1^0;` (C51 language) | none | none | none (Blink uses P1.0, LED to VCC) | no on-board supply: wire VCC (pin 40) and GND (pin 20); RST (9) high = reset, EA (31) must be high | `c51blink`, `c51run` |

- **Libraries:** Servo, LiquidCrystal, LiquidCrystal_I2C (+ Wire), DHT and OneWire/DallasTemperature work on all six Arduino-API boards (I²C on the board's default SDA/SCL pins: Nano/Pro Mini A4/A5, Mega D20/D21, ESP32 GPIO21/22, Pico GP4/GP5, Blue Pill PB7/PB6).
- **Errors** name the board and the line: e.g. `GPIO40 does not exist on this board.`, `GPIO35 is input-only (no output, no internal pull resistors).`, `A6 is an analog-only input …`, `PA8 has no analog input (ADC).`, `“dacWrite()” is not available on this board.`, `GPIO6 is connected to the module’s SPI flash …`, `#include <WiFi.h>` → “WiFi / Bluetooth are not simulated” at the include line, `Serial1` → “only Serial (the serial monitor) is simulated”, Arduino functions or timer/UART registers in an 8051 program → a C51-specific message; `INPUT_PULLDOWN` on the AVR boards is a compile error, as with the real AVR core.
- **8051 / C51:** `#include <reg52.h>` (and `reg51.h`, `intrins.h`), `sbit`, `sfr` names, `P1 = 0xFE;`, bit operations, `_crol_`/`_cror_`/`_nop_`, `void main()` with `while (1)`; `code`/`xdata`/`idata` … qualifiers are accepted and ignored. P0 is open-drain (needs external pull-ups to drive HIGH); P1–P3 are quasi-bidirectional (weak pull-up; write 1 to read a pin). Statement timing is scaled to the crystal, so a `delay_ms` counting loop written for 11.0592 MHz runs ≈ 8 % faster at 12 MHz.
- **Pro Mini 3.3 V/8 MHz:** the same program runs at half the instruction speed; `millis()`/`delay()` stay correct (as with the 8 MHz board definition).

## 74-series logic ICs (v13) / 74 系列逻辑 IC
Palette category **74 系列逻辑 / 74-series** (right after *Logic*), sub-sorted into gates · flip-flops and latches · counters · shift registers · decoders · multiplexers · arithmetic · bus drivers; searchable by part number (`7474`, `74hc595`, `LS138`, `cd4017`, `schmitt`, …). The generic AND/OR/NOT/NAND/NOR/XOR parts stay as they were (one implementation each); every 74xx part is an *additional* real DIP package with its data-sheet pin numbers (VCC/GND required, pin 1 top left). Full pin tables, function tables, usage tips and the example list: **[docs/74-series-en.md](docs/74-series-en.md) / [docs/74-series-zh.md](docs/74-series-zh.md)** (generated by `node tools/gen-ttl-docs.js` from the part data).

| Group | Parts |
|---|---|
| Gates (13) | 7400 NAND · 7402 NOR · 7404 NOT · 7407 buffer (open collector) · 7408 AND · 7410 3-in NAND · 7411 3-in AND · 7420 4-in NAND · 7427 3-in NOR · 7432 OR · 7486 XOR · **7414 Schmitt NOT** · **74132 Schmitt NAND** |
| Flip-flops / latches (8) | 7474 dual D (preset/clear) · 7476 / 74112 dual JK · 74273 octal D · 74373 / 74573 / 74574 octal latch / register (3-state) · 7475 quad latch |
| Counters (13) | 7490 decade · 7493 4-bit binary · 74160 / 74162 decade · 74161 / 74163 binary (sync) · 74190 / 74191 / 74192 / 74193 up-down · 74393 dual 4-bit · CD4017 · CD4040 |
| Shift registers (4) | 74164 · 74165 (74HC165) · 74194 universal · 74595 (74HC595, with output latch and /OE) |
| Decoders (5) | 74138 · 74139 · 74154 · 7447 (active-low, open collector) · 7448 (active-high; also 74LS48) |
| Multiplexers (3) | 74151 · 74153 · 74157 |
| Arithmetic (2) | 7483 4-bit adder · 7485 4-bit comparator |
| Bus (4) | 74244 · 74245 (DIR / /OE) · 74125 · 74126 |

Plus a **4-digit multiplexed 7-segment display** (*Lighting*, 12-pin 5641AS / 3641AS pin-out, common cathode or anode, per-segment burn-out check on the *average* current) for scanning displays.

- **Logic families.** Every part has a `family` property: **74HC** (2–6 V, CMOS thresholds 0.3 / 0.7·VCC, 50 Ω push-pull), **74HCT** (4.5–5.5 V, TTL thresholds 0.8 / 2.0 V), **74LS** (4.75–5.25 V, TTL thresholds, high level ≈ VCC − 1.5 V ≈ 3.4 V with 250 Ω, strong low side 40 Ω) and **74** (standard TTL); CD4000B parts are fixed (3–15 V, ≈ 400 Ω). Below the minimum working voltage the outputs go high-Z and the panel says *under-voltage*; without a supply it says *no supply*; outside the recommended range it warns; above the absolute maximum it says the part would be destroyed. Floating inputs: 74HC/HCT/CD are *undefined* (simulated as low, with a warning), 74LS/74 read *high* (internal pull-up, with a warning). Two outputs fighting on one net give an *output contention* hint. Open-collector parts (7407, 7447) need a pull-up; 7448 has internal 2 kΩ pull-ups; 3-state parts (74244/245/125/126/373/574/595) release the bus when disabled.
- **Timing model.** Ideal zero delay by default: after every solve the digital parts re-evaluate and, when an output changed, the step is solved again (delta cycles, ≤ 16 passes) so chains of gates, counters and shift registers settle inside one 0.2 ms step; the state is committed only when the step is accepted (the solver's rewind / sub-step logic therefore stays valid). The checkbox **"model propagation delay"** (plus optional `tpd` in ns, default = data-book typical: HC gate 9 ns, LS gate 10 ns, flip-flop 17–25 ns, counter 25–40 ns, …) makes every stage update one solve step later — the delay is *rounded up to the solve step* (0.2 ms), it is not a ns-accurate model. A loop without a stable state (three inverters in a ring) shows a *combinational loop* hint in zero-delay mode and oscillates (at the step rate) with the delay enabled.
- **Schmitt triggers** (7414, 74132): HC thresholds ≈ 0.31 / 0.53·VCC, LS / HCT 0.8 / 1.6 V. Plain gates have no hysteresis.
- **Properties panel.** Family, delay, live readout (supply status, every input and output as H / L / Z, floating inputs, contention) and an expandable **pin-out & function table** per part; the part symbol shows coloured dots on the pins (red = H, blue = L, grey = Z) and a supply LED.
- **Arduino + shift registers.** `shiftOut()` → 74HC595 and `shiftIn()` ← 74HC165 work with the simulated MCU: while the circuit contains 74-series logic, a pin change makes the MCU wait one minimum sub-step so the circuit reacts before the program reads or writes again (otherwise `digitalRead` right after raising a clock would see the old output). Consequence, as on real hardware: the 74HC165 shifts on the *rising* edge and Arduino's `shiftIn()` samples after raising the clock, so a plain `shiftIn()` returns the value shifted left by one bit (QH is already the next bit); the example reads the first bit by hand (`digitalRead(QH)` after /PL goes high) and lets `shiftIn()` read the other seven.
- **Examples (14, all under "74 系列：…").** SR latch from two 7400 NANDs · 7493 4-bit ripple counter + probes · 555 → 7490 → 7447 → 7-segment decade counter · 74161 sync counter · 74138 decoder with LEDs · Arduino `shiftOut` → 74HC595 running light · Arduino `shiftIn` ← 74HC165 reading 8 switches · 74373 latch on a bus · 74245 transceiver · 7483 adder (5 + 3 = 8) · 7485 comparator · 74194 twisted-ring counter · 7414 Schmitt RC oscillator · 7474 ÷2 / ÷4 divider.
- **Limits and things I could not verify against a data sheet.** Pin-outs are from the TI / Nexperia / onsemi data sheets of each part; where a part exists in several packages only the DIP is offered. The 7447 draws 6 and 9 as in the original 7447A (no top / bottom bar), which differs from some modern compatibles. 7448 / 74LS48 /BI-/RBO handling follows the function table but the internal pull-up of the bidirectional pin is not modelled in detail. Delays, output / input resistances and thresholds are rounded typical values (no temperature, no min/max, no setup / hold or minimum-pulse-width violations, no metastability, no supply-current spikes). Not included: 74266 / 7403, 74147 / 74148 priority encoders, 74181 ALU, 74AHC. CD4000B parts only have 4017 and 4040. No simulation of clock-to-output skew between parts (all parts update in the same step). HC-input floating is deterministic (low) — real floating CMOS inputs oscillate and draw current.

## Microcontrollers (v10) / 可编程单片机
Two programmable parts live in the new **单片机 Microcontrollers** palette category. You write a program, press **Compile & upload**, and the chip runs it in *simulated* time, driving LEDs, transistors, servos, the LCD and any other part through its pins and reading switches, dividers and sensors back.

- **Arduino Uno 开发板** (own drawing, not a photo or a copy of the real artwork):
  - Headers as on the real board: D0–D13 (top), A0–A5 (usable as digital pins 14–19), 5V, 3.3V, VIN and three GND (all GND pins are joined on the board).
  - PWM (`~`) on D3, D5, D6, D9, D10, D11 — 490 Hz, D5/D6 980 Hz, as on an ATmega328P.
  - On-board **L** LED on D13 (through 1 kΩ), ON LED, TX LED that flickers while it prints, a RUN / ERR Ln / OFF badge on the board and an activity dot next to each pin in use.
  - **Power** property: *USB* (an ideal 5 V source with 0.1 Ω, no wiring needed) or *external* (VIN → on-board 5 V regulator with 1.1 V dropout and 0.8 A limit; feed VIN with 7–12 V). The 3.3 V pin has its own 150 mA regulator. The board itself draws ≈ 45 mA.
  - The chip boots when its 5 V rail reaches 2.7 V and stops below 2.4 V (brown-out), so an external supply that sags really resets the program.
- **ATtiny85 单片机 (8 脚 DIP)**: pins PB0–PB5, VCC and GND in the real DIP-8 pinout. It has **no built-in supply** — connect VCC and GND (2.7–5.5 V). PWM on PB0, PB1, PB4; ADC channels A1 = PB2, A2 = PB4, A3 = PB3 (A0 = PB5). PB5 is RESET with an internal pull-up: pulling it low holds the chip in reset unless the *PB5 as I/O* property is ticked. `LED_BUILTIN` is PB1 (as on Digispark-style boards).
- **Pin electrical model:** an output is a 25 Ω push-pull driver to the chip's own VCC/GND rails, so a pin's high level sags under load (≈ 4.7 V at 12 mA) and a short is a real 200 mA fault (a toast warns above 40 mA). `INPUT` is high impedance (10 MΩ), `INPUT_PULLUP` adds 35 kΩ to VCC. `digitalRead` uses the ATmega thresholds: low below 0.3·VCC, high above 0.6·VCC, previous value in between (hysteresis). `analogRead` is 10-bit against VCC (`DEFAULT`) or 1.1 V (`INTERNAL`) and takes 112 µs; the parts have no AREF pin, so `EXTERNAL` is treated as VCC.
- **How a program runs:** the program is translated into JavaScript *generator* functions. Every `delay()`, `delayMicroseconds()`, `pulseIn()` and loop back-edge yields to the simulator, so time is simulated, not wall-clock: `delay(500)` toggles a pin after exactly 0.5 s of simulated time, whatever the speed setting, and the browser never blocks. Instructions cost a small amount of simulated time (≈ 0.25 µs per loop iteration, 3.5 µs per digital I/O, 112 µs per ADC conversion). Pin changes are timestamped and the solver splits the time step at each change (up to 256 events per step), so edges land on the exact simulated time (blink edges at 0.500 s, 1.000 s …, measured error < 0.1 µs) while PWM, tone and servo waveforms are generated as real switching (averaged automatically when the period is shorter than 4 time steps).
- **Languages** (the 编程语言 property, or the drop-down in the editor):
  - **Arduino C/C++ subset** (default): `setup()` / `loop()`, global and local variables, constants, `#define` (also function-like macros), `#include` (Servo.h / LiquidCrystal.h / Arduino.h are known; others give a warning), `#if/#ifdef/#ifndef/#elif/#else/#endif`, functions with parameters and return values (recursion allowed), `if/else`, `for`, `while`, `do…while`, `switch/case`, `break/continue/return`, ternary, all C operators with C precedence, compound assignment, `++/--`, casts, `sizeof`, arrays (also 2-D, initialisers), `enum`, `static` locals, `const`, `PROGMEM` (ignored), integer literals in dec/hex/octal/binary with `U`/`L` suffixes, char and string literals with escapes. Types `void bool boolean char unsigned char byte int unsigned int short word long unsigned long float double int8_t…uint32_t size_t String` with **AVR semantics**: `int` is 16-bit and wraps (32767 + 1 = −32768), `long` is 32-bit, integer division truncates, `/` and `%` by zero are runtime errors, `float` and `double` are the same.
  - **JavaScript** (`function setup()` / `function loop()`, `let/const`, closures): the same API as globals; your functions become generators automatically so `delay()` works anywhere. The JS sandbox is best effort (DOM and app globals are shadowed), not a security boundary — only run programs you trust.
- **Supported API:**
  - Digital / analogue: `pinMode` (`INPUT`, `OUTPUT`, `INPUT_PULLUP`), `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite`, `analogReference`.
  - Time: `delay`, `delayMicroseconds`, `millis`, `micros`.
  - Advanced I/O: `tone(pin, f[, ms])`, `noTone`, `pulseIn(pin, level[, timeout])`, `shiftOut`, `shiftIn`.
  - Maths: `min max abs constrain map sq sqrt pow sin cos tan asin acos atan atan2 exp log log10 floor ceil round fabs fmod trunc radians degrees isnan isinf`, constants `PI HALF_PI TWO_PI DEG_TO_RAD RAD_TO_DEG`; `random`, `randomSeed`.
  - Bits and bytes: `bit bitRead bitSet bitClear bitWrite lowByte highByte`.
  - Characters: `isDigit isAlpha isAlphaNumeric isSpace isWhitespace isUpperCase isLowerCase isPunct isHexadecimalDigit isPrintable isControl isAscii isGraph`.
  - C strings: `char[]`, `strlen strcmp strcpy strcat sprintf snprintf` (`%d %i %u %ld %x %X %o %c %s`, width / zero-pad; `%f` prints `?` as in avr-libc), `F()`.
  - `String`: constructors (number with base or decimals), `+` / `+=`, comparison, `length charAt setCharAt indexOf lastIndexOf substring startsWith endsWith equals equalsIgnoreCase compareTo concat replace remove trim toUpperCase toLowerCase toInt toFloat toDouble c_str reserve isEmpty`.
  - `Serial`: `begin end available read peek print println write flush parseInt parseFloat readString readStringUntil setTimeout availableForWrite` (`DEC HEX OCT BIN`, float digits). Output appears in the serial monitor and the readings; text typed in the monitor is the RX input.
  - `Servo` (`#include <Servo.h>`): `attach(pin[, min, max]) write writeMicroseconds read readMicroseconds attached detach` — a real 50 Hz pulse train for the SG90 servo part.
  - `LiquidCrystal` (`#include <LiquidCrystal.h>`, 4-bit or 8-bit constructor): `begin clear home setCursor print write cursor noCursor blink noBlink display noDisplay scrollDisplayLeft scrollDisplayRight autoscroll noAutoscroll leftToRight rightToLeft createChar` — drives the LCD1602 part (wire RS, E and D4–D7 to the pins named in the constructor; contrast and backlight are still analogue).
  - Accepted as no-ops: `interrupts()`, `noInterrupts()`, `yield()`.
- **Program editor** (double-click the chip, or ✎ 编辑程序 in the properties panel): a floating, draggable and resizable window with line numbers, Tab / Shift+Tab indentation, auto-indent on Enter, `}` de-indent, **Check**, **Compile & upload** (also Ctrl+S / Ctrl+Enter), **Reset chip** and **Revert**. Compile errors are localised, name the line, mark it red in the gutter and scroll to it (click the message to select the line). Runtime errors (division by zero, array index out of range, stack overflow, runaway loop) stop the program, show **ERR L<n>** on the chip and a toast. Unsaved edits are kept as a draft per chip while you switch between chips.
- **Serial monitor** (bottom of the editor, or ⌨ 串口监视器): live output with autoscroll and clear, a send box (Enter appends `\n`), and the baud rate from `Serial.begin`. Output is capped at the last 20 000 characters.
- **Saving:** the program text and language are ordinary properties of the part, so they are saved with the circuit (localStorage, autosave, exported JSON), undo/redo covers uploads, and a circuit with a program opens unchanged in any UI language.
- **Runaway guard:** a JavaScript loop that never yields stops with "runaway loop" after 400 000 iterations in one time step. A C `while (1) {}` behaves like real hardware: the chip is busy forever (simulated time advances, pins keep their state), but the browser stays responsive.
- **Examples:** Blink (on-board L + external LED on D8), traffic light (D10/D9/D8), button with `INPUT_PULLUP` (D2 → LED on D7, prints pressed/released), potentiometer → `analogRead` → PWM LED with `Serial` and an oscilloscope on D9, servo sweep (D9), LiquidCrystal "Hello, Arduino!" with a counter, ATtiny85 blink on a 5 V battery. **v10.1:** debounced button toggling an LED, LDR night light (A0 divider → LED on D9 in the dark), `millis()` multitasking (two LEDs at different rates + Serial), PWM motor speed via a logic-level MOSFET with flyback diode, relay module switching a 12 V lamp on a timer, `tone()` melody on a passive buzzer, ATtiny85 PWM fade on PB0/PB1. All 14 are also in the pinout panel.

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
| Sensors 传感器 (v11) | 25 new parts, see *Sensors (v11)* above; LCD1602 I2C in Drivers & displays |
| Microcontrollers 单片机 (v10) | Arduino Uno-style board (USB or VIN power, D0–D13, A0–A5, PWM, on-board L LED) and ATtiny85-style DIP-8 chip, both programmable in Arduino C or JavaScript (see *Microcontrollers*) |
| Other 其他 | Breadboard (20, 30 or 40 columns); ground; wire |

## Usage
- **Parts:** drag parts from the palette, or click one to drop it at the centre. R rotates, Del deletes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Y undo and redo, Space runs or pauses (hold Space and drag to pan). V toggles the Select tool, Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+X work on the selection, and the arrow keys nudge it (see *Selection & group editing*).
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
**v13 (74 系列):** 7400 SR latch · 7493 ripple counter · 555 → 7490 → 7447 → 7-segment · 74161 · 74138 + LEDs · Arduino shiftOut → 74HC595 · Arduino shiftIn ← 74HC165 · 74373 · 74245 · 7483 adder · 7485 comparator · 74194 ring counter · 7414 Schmitt oscillator · 7474 divider.

**v11 (传感器):** HC-SR04 ultrasonic → LCD1602 · DHT22 → serial monitor · PIR + light-sensor night light · soil moisture alarm (buzzer) · MQ-2 gas alarm (relay) · LM35 thermometer · two-channel TCRT5000 line tracker · KY-040 encoder counter · ACS712 current monitor · DS18B20 thermometer · I2C LCD1602 (PCF8574) with TMP36. All are in the examples menu and in the reference panel's 传感器 section (load / insert / copy).

**v10.1 (单片机):** debounced button · LDR night light · millis() multitasking · MOSFET motor PWM · relay timer · tone() melody · ATtiny85 PWM fade.

**v10 (单片机):** Arduino blink · traffic light · button with INPUT_PULLUP · potentiometer → PWM with Serial and scope · servo sweep · LiquidCrystal LCD1602 · ATtiny85 blink.

**v7:** MOV surge clamp (220 V mains → 100 mH line choke → 14D471K ∥ 40 W bulb; press the button to dump a 1 kV / 220 µF surge through 10 Ω: the MOV clamps at ≈742 V / 15.6 A and absorbs ≈15 J, the bulb survives — delete the MOV and the bulb sees ≈906 V and burns) · TL431 reference 12 V → 4.991 V (R1 = R2 = 10 k) · LM393 + LDR night light (LED on in the dark) · L298N motor forward / reverse / brake with two switches · relay module (low-level trigger) switching a 12 V lamp · Hall A3144 and reed switch LEDs · LCD1602 "Hello, DCACLab!" with backlight and contrast resistor · active buzzer + 1 kHz crystal oscillator driving a passive buzzer.

Ohm's law · series and parallel bulbs · RC charging · LED + resistor · fuse and short circuit · dimmer (multimeter A jack) · AC half-wave · RLC · scope: RC low-pass (sine) · scope: square wave RC · NPN transistor switch · Zener regulator · 555 astable LED blinker · breadboard LED circuit ·
**v5:** DC-DC boost module: 3.7 V Li-ion (50 mΩ) → MT3608 set to 12 V → 12 V 5 W bulb, with a voltmeter and ammeter on the input (3.62 V, 1.53 A) and on the output (12.00 V, 416.6 mA), η = 90 %.
**v6:** 7805 regulator 9 V → 5.000 V into 100 Ω with 330 nF / 100 µF capacitors and two voltmeters · LM317 adjustable supply 12 V → 5.036 V (240 Ω + 2 kΩ pot as R2, turn the pot to change Vout) · RGB LED colour mixing with three pots · PC817 optocoupler isolating a 5 V switch circuit from a 9 V LED circuit · SCR latch (trigger button → LED stays on, NC reset button turns it off) · 4×AA battery holder + LM2596 buck → 3.3 V bulb with meters on the input and output.
**v3:** op-amp inverting ×(−10) · op-amp non-inverting ×10 · op-amp comparator night-light (LDR vs potentiometer, 0…9 V rails, LED) · logic half adder (XOR + AND, two switches, two probes) · 2 Hz clock blinker + NOT gate · 4-bit D-flip-flop ripple counter → 7-segment display · scope X-Y Lissajous 1:2 · scope FFT of a square wave and its RC-filtered version · relay switching two bulbs (NO / NC, flyback diode) · DC motor with rheostat and ammeter · transformer 2:1 + bridge rectifier + 470 µF filter (≈ 6.9 V DC) · NTC and LDR divider sensors with voltmeters.

## Tests
`tests/` contains the Playwright scripts used during development. They need `npm i playwright-core`, a Chrome at `/usr/bin/google-chrome`, and the folder served on port 8765. The older suites run the page with `locale: 'zh-CN'`.
- `test12.js` runs **72 v10.1 checks**:
  - every pinout/usage/example/wire-colour key exists in all 10 locales;
  - pin facts in the reference data against the simulator's board definitions and the datasheets (PWM pins and frequencies, ADC channels, I²C/SPI/UART/interrupt pins, ATtiny85 DIP order, limits);
  - the panel in all 10 languages for both chips: opened from the properties panel and the editor toolbar, board toggle, side-by-side with the editor without overlap, scrollable, contents (SVG, every pin row, limits, simulation notes, usage, examples), no Chinese in non-Chinese locales; live language switch and section navigation;
  - every usage code snippet compiles;
  - the new examples are in the examples menu; all 14 examples load from the panel and run with no runtime error, no non-converged step and no warning, with behaviour checks on their output (debounced press count, night-light PWM value, multitask uptime, motor speed, relay ON → OFF, tone notes, both ATtiny fade LEDs);
  - insert into editor, upload, board mismatch warning, no-chip message, copy to clipboard;
  - wire colours: palette in the panel, single and multi-wire change as one undo/redo step, custom picker, remembered colour for new wires (also after reload), save/load, selection export, old files without colour, different colours not merged while same colours merge, the outline on white wires; the colour UI in 10 languages.
- `test15.js` runs **151 v13 checks**: library structure (category next to *Logic*, 52 parts, 8 sub-groups, no duplicates, every pin-out against the data sheets, DIP geometry); exhaustive truth tables of all 13 gates; 7407 open-collector + pull-up; flip-flops (7474 preset/clear/edge, 7476/74112 JK, 74273, 74373/74573 transparent/hold/3-state, 7475); counters 7490 / 7493 / 74160–74163 (clear, load, enable, ripple-carry), 74190–74193 (up/down, load, wrap), 74393, 4017, 4040; shift registers 74164 / 74165 / 74194 / 74595; decoders 74138 / 74139 / 74154, multiplexers 74151 / 74153 / 74157; 7447 / 7448 segment patterns 0–15 and lamp-test / blanking; 7483 (512 combinations) and 7485 (1280 combinations with cascade inputs); Arduino `shiftOut` → 74HC595 (byte and running light) and `shiftIn` ← 74HC165 (documented idiom and the one-bit shift of the plain call); tri-state (74245 direction and /OE, 74244 / 74125 / 74126), bus contention hint and toast, open-collector wired-AND; families (HC at 2.5 / 3.3 / 6 V, under-voltage, no supply, LS 4 V / 6 V / over-voltage, HCT, thresholds HC vs HCT vs LS, floating inputs, VOH, drive into 1 kΩ / 100 Ω); Schmitt hysteresis measured by a voltage sweep (7414 HC / LS, 74132) and no hysteresis on 7404; zero-delay chain, rippling delay chain, ring oscillator with and without delay; save / load; palette category, sub-groups, search by part number; info panel with live pin states; dictionary keys + placeholders in all 10 languages; the 14 examples (no non-convergence, no wire pass-over, no contention, no combinational loop, behaviour of each: latch state, 16 / 10 counter states, decoder output, running-light patterns, switches read = 162, 5 + 3 = 8, 5 < 6, oscillation, ÷2 / ÷4); the 4-digit display (common cathode and anode); no page errors.
- `shots14.js` makes screenshots 79–93 (74-series category, part-number search, SR latch, 7490 → 7447 → 7-segment, Arduino + 74HC595, 74138, 74161, Arduino + 74HC165, 7483, 7414 oscillator, 7474 divider, 74245, property panel with live pin states and function table, under-voltage hint).
- `test14.js` runs **178 v12 checks**: the 7 new boards in the palette; default Blink on every board (edges within 1 %, no non-convergence); power from USB and from the supply pins (Nano/Mega VIN regulator and dropout, Pro Mini RAW 5 V / 3.3 V variants, ESP32 VIN/3V3/EN, Pico VBUS/VSYS/RUN, Blue Pill 5V/NRST, 8051 VCC/RST/EA) and brown-out; `analogRead` half-scale and 20 % points at 10 and 12 bits; `INPUT_PULLUP` + switch; PWM average through an RC filter; ESP32 DAC, DAC→ADC loop-back, touch, `ledc`, `INPUT_PULLDOWN`, 32-bit `int`, `analogReadMilliVolts`; Pico VSYS/3 on A3, GP24 VBUS sense, `analogWriteRange`; Blue Pill active-low PC13; 8051 port writes, open-drain P0, quasi-bidirectional input and the crystal property; wrong-pin / board-API / WiFi errors with line numbers; Servo, DHT22, DS18B20, LCD I2C and LiquidCrystal on all six Arduino-API boards; all 14 board examples (no errors, no pass-overs, board-specific output checks); save/load; all v12 keys in 10 locales; the pinout panel for every board in en and zh-CN (no raw keys) and loading an example from it.
- `shots13.js` makes screenshots 71–78 (MCU category with all boards, ESP32 / Pico / Mega pinout panels, ESP32 DAC + ADC + touch, Pico ADC → PWM, Blue Pill ADC and 8051 running light).
- `test13.js` runs **62 v11 checks**: every v11 key in all 10 locales with placeholders; all 26 new parts place, converge and show readings with no raw keys (and no Chinese in en/ru); datasheet values (LM35 25 °C → 250 mV, TMP36 25 °C → 750 mV, ACS712-5A 5 A → 2.5 + 0.185·5 = 3.425 V, ACS712-20A at −10 A, MPX5010DP, ACS712 measuring a real 2 A current); HC-SR04 at 100 cm → 5.83 ms within 2 %, 30 cm, out of range; DHT22 and DHT11 values through the DHT library, DHT not wired → fail + toast; DS18B20 −10.3125 °C, missing pull-up → −127 + toast; encoder counts; PIR level; signal source animation; save/load; LCD diagnostics (contrast, wrong pin, the user case D4–D7 → D2–D5 reversed with the suggested fix verified, swapped order, no begin, 7-arg constructor, I2C code with a parallel LCD); I2C LCD (text, address mismatch, 0x3F, swapped/wrong pins, unpowered, backlight, Wire.requestFrom error, ATtiny85 PB0/PB2); all 11 sensor examples run 3 s with no error or warning; palette search; the reference panel's sensors section in all 10 locales; no page errors.
- `shots12.js` makes screenshots 64–70 (sensor category, ultrasonic + LCD running, DHT22 + serial monitor, signal-source properties, PIR + light multi-sensor circuit, I2C LCD running, the reference sensors section).
- `shots11.js` makes screenshots 58–63 (Uno pinout panel, ATtiny85 pinout panel, a usage section, the examples section, a new example running, coloured wires).
- `test11.js` runs **81 v10 microcontroller checks** (74 at v10, plus the new examples):
  - translator: a program using most of the C subset prints 40 values that are compared line by line with AVR semantics (16-bit wrap, truncating division, `%` sign, unsigned wrap, HEX/BIN printing, macros, enums, static locals, recursion, `String`, `switch` fall-through, 2-D arrays, `sprintf`, `strcpy/strcat` …);
  - 13 compile errors (missing `;`, undeclared name, wrong argument count, pointer, missing `loop`, unterminated string, type mismatch, `break` outside a loop, bad array size, unknown method, local function, unexpected end of file, JavaScript syntax error) each report the right line and a localised message; the chip shows the error;
  - timing: Blink toggles every 500 ms within 1 % (in practice < 0.1 µs), the JavaScript Blink every 250 ms, `millis()`/`micros()` after `delay(1000)`, on-board LED current;
  - `INPUT_PULLUP` + button (pin voltage, LED, Serial events), `digitalRead` thresholds and hysteresis swept with a potentiometer;
  - `analogRead` of a 10 k/10 k divider (511), the 3.3 V rail (≈ 676) and a pot at 25 % (256);
  - PWM: average = duty × high level at 50 % and 80 %, 490 rising edges per second on D9, 980 Hz on D5, the oscilloscope shows a 0–4.7 V square wave at ≈ 490 Hz, Serial values;
  - Serial input echo; runtime errors with line numbers (division by zero, index out of range, stack overflow); the JavaScript runaway guard; a C busy loop does not freeze the page;
  - power: external 9 V on VIN, brown-out at 3 V and reboot at 7 V; the ATtiny85 needs VCC, blinks PB0 every 500 ms, and is held in reset by a low PB5;
  - Servo pulses 1.0–2.0 ms at 50 Hz and a full sweep; LiquidCrystal text on the LCD1602;
  - save / load in another page and language reproduces the program and its output; the saved JSON is language-neutral; upload + undo;
  - all MCU examples run 3 simulated seconds with no runtime error, no non-converged step, no pass-over and no warning, each in < 2.5 s of wall time;
  - editor UI: double-click opens it with the program, a compile error marks line 14, Ctrl+S uploads, serial monitor output and send box, Tab, auto-indent, properties-panel buttons, live language switch;
  - all new keys in all 10 locales, MCU UI free of Chinese in en / ja / ru; the user 7805 fixture still converges with 0 failed steps.
- `shots10.js` makes screenshots 52–57 (editor with Blink, running board + serial monitor, pot → PWM with oscilloscope, ATtiny85, LCD1602, compile error).
- `test10.js` runs **52 v9 checks**:
  - box select with real mouse drags (window and crossing, compared against an independent rule), Shift+drag in normal mode, Ctrl+click add/remove for parts and wires, Ctrl+A, Esc, select-mode toggle with V;
  - group drag: moved parts, unchanged connectivity partition and readings, one undo step; exact undo, redo;
  - arrow nudge; group rotation keeps connectivity and readings;
  - copy/paste with internal wires, not connected to the original; Ctrl+D; delete; undo of each in one step; a breadboard group carries its plugged parts;
  - export dialog: the default scope, sanitised names with `.json`, selection JSON content and normalised positions, a whole-circuit export setting the title, Esc to cancel, sanitiser edge cases;
  - re-import of the selection as merge (an isolated, selected, draggable group) and as replace; import into an empty canvas;
  - wire auto-merge: a chain of 3 becomes 1 with the same readings, a T-junction stays 3, deleting its branch re-merges, no merge on a terminal, split by a mouse drop then re-merge after deleting the branch, an old v1 save normalising on load;
  - Space+drag pan vs Space tap; touch long-press box select;
  - all new keys in all 10 locales; no Chinese or raw keys in the new UI in en/de/ru/pt-BR (ja may use kanji).
- `shots9.js` makes screenshots 48–51 (box select, group move, export dialog, wire auto-merge).
- `test9.js` runs the **i18n checks** (87). It covers:
  - every locale has exactly the zh-CN key set, with no empty values and the same placeholders and tags; the fallback chain works;
  - for each locale: `?lang`, `<html lang>`, the title, the meta description and the dropdown;
  - a DOM scan of the toolbar, the examples menu, the palette, the status bar, the properties panel of every part type, wire properties, the HUD, the analysis table, toasts and readings. The scan checks for raw keys, for Chinese characters in non-Chinese locales, and for Simplified-only characters in `ja` and `zh-TW`;
  - one example runs per locale, and all 49 examples run in every non-Chinese locale without Chinese text appearing;
  - auto-detection from `navigator.languages`, persistence, `?lang` precedence, and rejection of an invalid `?lang`;
  - live switching keeps the circuit and the running simulation; saved JSON is language-independent; `file://` works.
- `shots8.js` makes screenshots 44–47 (en, ja, es, and the language menu).
- `test2.js` clicks through the v9 export dialog for its export check.
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
- v13 74-series logic (simplifications): see the *74-series logic ICs (v13)* section above — zero-delay delta-cycle model by default, optional delay rounded to the 0.2 ms solve step, typical-value electrical models, no setup/hold or metastability, floating CMOS inputs read as low, `shiftIn()` on a 74HC165 is shifted by one bit as on real hardware, parts not included (74266, 74147/148, 74181, 74AHC).
- v12 boards (simplifications):
  - **WiFi / Bluetooth** (ESP32, and the Pico W, which is not offered) are not simulated; including `WiFi.h`, `BluetoothSerial.h`, `esp_now.h` etc. gives a clear error at the `#include` line.
  - Only the virtual `Serial` monitor exists: `Serial1`–`Serial3` (Mega), `Serial2` (ESP32), `Serial1`/`Serial2` (Pico, Blue Pill) are documented in the pinout panel but not simulated (using them gives a clear error); there are no TX/RX pin waveforms.
  - ESP32 ADC is modelled as linear over 0–3.3 V (the real ADC is non-linear near the ends and depends on the attenuation setting; `analogSetAttenuation` is not supported); `touchRead` takes the "finger on pad" state from a board property instead of a capacitance; GPIO0/2/5/12/15 strapping functions, deep sleep and the hall sensor are not modelled.
  - Pico: the buck-boost converter is ideal (no ripple, efficiency or current limit); 3V3_EN and ADC_VREF are not on the part; GP23 (SMPS power-save) only exists as an internal pin; PIO, the second core and USB device functions are not simulated.
  - Blue Pill: the 5 V-tolerant (FT) pins are documented but every input is modelled with the same input structure; no clock-tree, BOOT0/BOOT1 or DFU behaviour.
  - 8051: only the I/O ports are simulated — no timers, interrupts (`interrupt n` functions), UART (`SCON`/`SBUF`), external memory or ALE/PSEN signals. The crystal is a property, not a wired part (XTAL1/XTAL2 pins are shown but unused). EA left open is treated as HIGH (internal program memory), as on boards with EA tied to VCC. The 8051 is programmed in a C51 subset (`code`/`xdata`/`idata` qualifiers are accepted and ignored).
  - Timing is statement-level, not cycle-accurate on any board (see v10 below); the Pro Mini 3.3 V variant is modelled by halving the instruction speed.
  - PWM at 1 kHz (ESP32 / Pico / Blue Pill default) is real switching with exact edge times, but plotting a pin by sampling only once per Δt (0.2 ms) can alias the duty cycle; an RC low-pass (as in `test14.js`) shows the true average.
- v11 sensors (simplifications):
  - Sensors are driven by their property / signal source, not by a physical scene (no moving objects, sound field or gas diffusion).
  - DHT11/22 and DS18B20 are modelled at **library level**: the DHT and OneWire/DallasTemperature calls check power, ground, the data pin and the pull-up in the circuit and return the sensor's value. For the DHT the host start pulse and the sensor's 40-bit answer are drawn on the DATA line (visible on the scope), but the library decodes the bits from the sensor model rather than by sampling the pin; DS18B20 bus traffic is not drawn. Library call durations are approximate.
  - I2C is also **library level** and only for the LCD1602 I2C part: no waveform on SDA/SCL, no other I2C devices, no `Wire.requestFrom()`. The backpack's pull-ups and supply current are modelled.
  - LCD libraries: `createChar()` is accepted but custom glyphs are not drawn; `cursor`/`blink` (no visible cursor), `autoscroll`, `leftToRight`/`rightToLeft` are accepted but have no visible effect.
  - The parallel LCD is still written at display-memory level (no HD44780 bus timing); V0 contrast is an empirical visibility curve, and a floating V0 is modelled as pulled down through an internal ≈ 22 kΩ.
  - MQ gas sensors ignore heater warm-up, humidity and temperature; the curve is a single power law per model.
  - The sound module's AO is linear in dB between 40 and 100 dB; no audio waveform.
  - LM35 in the single-supply circuit does not go below 0 V (negative temperatures need a negative supply, as on the real part).
  - SW-520D tilt switch: closed below 30°, open above 60°, hysteresis in between (simplified). Flex sensor and FSR use simplified curves (linear bend, R ≈ 10 kΩ/F). The water-level and soil/rain curves are simplified monotonic curves, not calibrated to a specific board.
  - HC-SR501 has no warm-up time and no sensitivity range; HC-SR04 has no beam angle, minimum-target size or echoes.
- v10.1 pinout reference and wire colours:
  - The reference documents pins and functions the simulated parts do not have or do not simulate (RESET/AREF/IOREF/ICSP headers on the Uno, external interrupts, I²C, SPI, hardware UART pins, the ATtiny85 USI and clock pins); these are clearly marked as not simulated.
  - Library side effects listed in the text (e.g. `tone()` disabling PWM on D3/D11, `Servo` disabling PWM on D9/D10) are real-hardware facts and are not modelled.
  - Serial on the ATtiny85 is a virtual monitor (the real chip has no hardware UART).
  - Wires of different colours are not merged, so a recoloured chain stays as several wires.
- v10 microcontrollers:
  - The C dialect is a subset: no pointers, references, `struct`/`class`/`union`, templates, `goto`, function pointers, `new`/`delete`, interrupts (`attachInterrupt`, ISRs, timers/registers such as `PORTB`, `DDRB`), EEPROM, Wire (I²C) beyond the LCD1602 I2C subset (v11), SPI or SoftwareSerial. Unsupported syntax gives a clear "不支持的语法" error with the line number rather than a wrong result.
  - Program execution is not cycle-accurate: each statement costs a fixed small amount of simulated time, so tight loops run at roughly real speed but not to the clock cycle. `millis()` is exact; `micros()` has 1 µs resolution.
  - Inputs (`digitalRead`, `analogRead`, `pulseIn`) see the circuit as solved at the start of the current time step (200 µs by default), so `pulseIn` and very fast polling have Δt resolution. Outputs are exact to the event (the step is split).
  - PWM, `tone()` and Servo frames are real switching only when their period is at least 4 Δt; faster signals (e.g. `tone` above ≈ 1.2 kHz at the default Δt) are averaged to their duty cycle.
  - LiquidCrystal writes the LCD's display memory directly; the HD44780 bus timing is not simulated, so a wrong data-pin wiring is reported by the LCD's own readings rather than garbled characters.
  - `Serial` has no baud-rate timing (output appears instantly) and no TX/RX pin signals on D0/D1.
  - The JavaScript mode is sandboxed on a best-effort basis only (it runs in the page); it is meant for your own programs.
  - A C program stuck in an endless loop without `delay()` keeps the chip busy forever, exactly as on hardware; use **Reset chip** or upload a fix.
- v9 selection and wires:
  - When a group moves, wires to unselected parts are stretched by moving their end and the adjacent bend only. They are not re-routed around other parts, so after a long move a stretched wire may cross other parts; drag its segments to tidy it.
  - Copy/paste uses an in-app clipboard (also kept in `localStorage`, so it works across tabs of the same browser), not the system clipboard.
  - Parts selected while plugged into an *unselected* breadboard leave the board when moved, exactly as a single part does.
  - Auto-merge only joins wire ends at free points; a wire end lying on the middle of another wire is still joined by splitting (as before), and wires that cross without an end are never connected.
