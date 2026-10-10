# 74-series / CD4000 logic ICs — reference

Generated from the part data (`node tools/gen-ttl-docs.js`): pin tables, function tables, usage tips and examples. DIP pin numbers come from the manufacturers' data sheets (TI SN74xx, Nexperia / Philips 74HC, onsemi CD4000B); seen from the top, pin 1 is at the top left and the numbering runs down the left side and up the right side. A leading `/` in a pin name means active low.

## Logic-family model

Every 74-series part has a "family" property. The family sets the supply range, the input thresholds, the output levels and drive, and the typical propagation delay. The values are rounded data-sheet typicals.

| Family | Recommended supply | Works from | Absolute max | Input low / high threshold (5 V) | Output high | Output resistance high / low | Inputs |
|---|---|---|---|---|---|---|---|
| 74HC | 2–6 V | 2 V | 7 V | 1.5 V / 3.5 V | VCC | 50 Ω / 50 Ω | CMOS (floating = undefined) |
| 74HCT | 4.5–5.5 V | 4 V | 7 V | 0.8 V / 2 V | VCC | 50 Ω / 50 Ω | CMOS (floating = undefined) |
| 74LS | 4.75–5.25 V | 4 V | 7 V | 0.8 V / 2 V | VCC − 1.5 V | 250 Ω / 40 Ω | pull-up (floating = high) |
| 74 | 4.75–5.25 V | 4 V | 7 V | 0.8 V / 2 V | VCC − 1.5 V | 130 Ω / 25 Ω | pull-up (floating = high) |
| CD4000B | 3–15 V | 3 V | 18 V | 1.5 V / 3.5 V | VCC | 400 Ω / 400 Ω | CMOS (floating = undefined) |

- Below the "works from" voltage the outputs are high-Z and the part does nothing; the properties panel shows "under-voltage". With no supply it says "no supply".
- Outside the recommended range (but still functional) the panel says "outside the recommended range"; above the absolute maximum it says the part would be destroyed.
- Floating 74HC inputs are undefined: the simulator reads them as low and shows a warning. Floating 74LS / 74 (TTL) inputs read as high (internal pull-up), also with a warning — always tie unused inputs to VCC or GND.
- Schmitt-trigger inputs (7414, 74132) have hysteresis: about 0.31·VCC / 0.53·VCC for HC and 0.8 V / 1.6 V for LS. Plain gates have none and switch in the middle of the VIL..VIH band.
- When two outputs fight on one net (bus contention) the node sits at a mid level and the part reports "output contention".

### Propagation delay

By default the model is ideal, zero delay: gate chains settle inside one simulation step (iterated within the solve step, like delta cycles in Verilog). With "model propagation delay" every stage delays its output by one solve step (0.2 ms, far longer than nanosecond delays, so the delay is rounded to the step); tpd can be set, 0 means the data-sheet typical. A combinational loop without a stable state (e.g. a ring of three inverters) is flagged as a "combinational loop" in zero-delay mode; with delay enabled it runs as a ring oscillator (the frequency is set by the solve step, not by real ns delays).

| Type | HC | HCT | LS | 74 | CD4000B |
|---|---|---|---|---|---|
| gate | 9 ns | 12 ns | 10 ns | 11 ns | 80 ns |
| flip-flop | 17 ns | 20 ns | 20 ns | 25 ns | 150 ns |
| latch | 15 ns | 18 ns | 16 ns | 20 ns | 100 ns |
| counter | 25 ns | 28 ns | 30 ns | 40 ns | 150 ns |
| shift register | 20 ns | 22 ns | 22 ns | 26 ns | 150 ns |
| decoder | 14 ns | 16 ns | 15 ns | 20 ns | 150 ns |
| multiplexer | 15 ns | 18 ns | 17 ns | 20 ns | 150 ns |
| arithmetic | 25 ns | 28 ns | 30 ns | 40 ns | 200 ns |
| bus driver | 7 ns | 10 ns | 9 ns | 12 ns | 80 ns |
| display driver | 100 ns | 100 ns | 100 ns | 100 ns | 150 ns |

## Usage tips

- Tie unused inputs to VCC or GND; unused gate outputs may float.
- Every IC needs VCC and GND; the examples feed them from a 5 V battery / the Arduino 5V pin.
- A 74HC output can drive an LED + 330 Ω directly; a 74LS high level is only about 3.4 V, so sinking current (LED to VCC) suits it better.
- Only one 3-state output may be enabled on a bus at a time.

## Parts

- **Logic gates**: [7400](#7400--quad-2-input-nand) · [7402](#7402--quad-2-input-nor) · [7404](#7404--hex-inverter) · [7407](#7407--hex-buffer-open-collector-outputs) · [7408](#7408--quad-2-input-and) · [7410](#7410--triple-3-input-nand) · [7411](#7411--triple-3-input-and) · [7420](#7420--dual-4-input-nand) · [7427](#7427--triple-3-input-nor) · [7432](#7432--quad-2-input-or) · [7486](#7486--quad-2-input-exclusive-or) · [7414](#7414--hex-schmitt-trigger-inverter) · [74132](#74132--quad-2-input-schmitt-trigger-nand)
- **Flip-flops and latches**: [7474](#7474--dual-d-flip-flop-with-preset-and-clear) · [7476](#7476--dual-jk-flip-flop-with-preset-and-clear) · [74112](#74112--dual-jk-negative-edge-triggered-flip-flop-with-preset-and-clear) · [74273](#74273--octal-d-flip-flop-with-clear) · [74373](#74373--octal-transparent-latch-with-3-state-outputs) · [74573](#74573--octal-transparent-latch-with-3-state-outputs-flow-through-pin-out) · [74574](#74574--octal-d-flip-flop-with-3-state-outputs-flow-through-pin-out) · [7475](#7475--4-bit-bistable-latch)
- **Counters**: [7490](#7490--decade-counter-divide-by-2-and-divide-by-5) · [7493](#7493--4-bit-binary-counter-divide-by-2-and-divide-by-8) · [74160](#74160--synchronous-decade-counter-asynchronous-clear) · [74161](#74161--synchronous-4-bit-binary-counter-asynchronous-clear) · [74162](#74162--synchronous-decade-counter-synchronous-clear) · [74163](#74163--synchronous-4-bit-binary-counter-synchronous-clear) · [74190](#74190--synchronous-updown-decade-counter-single-clock-du) · [74191](#74191--synchronous-updown-4-bit-binary-counter-single-clock-du) · [74192](#74192--synchronous-updown-decade-counter-dual-clock) · [74193](#74193--synchronous-updown-4-bit-binary-counter-dual-clock) · [74393](#74393--dual-4-bit-binary-ripple-counter) · [CD4017](#cd4017--cd4017-decade-counter-with-10-decoded-outputs-cmos-4000) · [CD4040](#cd4040--cd4040-12-stage-binary-ripple-counter-cmos-4000)
- **Shift registers**: [74164](#74164--8-bit-serial-in-parallel-out-shift-register) · [74165](#74165--8-bit-parallel-load-serial-out-shift-register) · [74194](#74194--4-bit-bidirectional-universal-shift-register) · [74595](#74595--8-bit-serial-in-shift-register-with-3-state-output-latch)
- **Decoders / display drivers**: [74138](#74138--3-to-8-line-decoder--demultiplexer) · [74139](#74139--dual-2-to-4-line-decoder--demultiplexer) · [74154](#74154--4-to-16-line-decoder--demultiplexer) · [7447](#7447--bcd-to-seven-segment-decoder--driver-active-low-open-collector-outputs) · [7448](#7448--bcd-to-seven-segment-decoder--driver-active-high-outputs-with-2-k-pull-ups)
- **Multiplexers**: [74153](#74153--dual-4-to-1-data-selector--multiplexer) · [74151](#74151--8-to-1-data-selector--multiplexer) · [74157](#74157--quad-2-to-1-data-selector--multiplexer)
- **Arithmetic / comparison**: [7483](#7483--4-bit-binary-full-adder-with-fast-carry) · [7485](#7485--4-bit-magnitude-comparator)
- **Bus drivers**: [74244](#74244--octal-buffer--line-driver-with-3-state-outputs) · [74245](#74245--octal-bus-transceiver-with-3-state-outputs) · [74125](#74125--quad-bus-buffer-with-3-state-outputs-active-low-enables) · [74126](#74126--quad-bus-buffer-with-3-state-outputs-active-high-enables)

## Logic gates

### 7400 — Quad 2-input NAND

Quad 2-input NAND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `1Y` | output |
| 4 | `2A` | input |
| 5 | `2B` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `4Y` | output |
| 12 | `4A` | input |
| 13 | `4B` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A AND B)
A B | Y
0 0 | 1
0 1 | 1
1 0 | 1
1 1 | 0
```

**Related examples**: 74-series: SR latch from two 7400 NAND gates

### 7402 — Quad 2-input NOR

Quad 2-input NOR. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1Y` | output |
| 2 | `1A` | input |
| 3 | `1B` | input |
| 4 | `2Y` | output |
| 5 | `2A` | input |
| 6 | `2B` | input |
| 7 | `GND` | ground |
| 8 | `3A` | input |
| 9 | `3B` | input |
| 10 | `3Y` | output |
| 11 | `4A` | input |
| 12 | `4B` | input |
| 13 | `4Y` | output |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A OR B)
A B | Y
0 0 | 1
0 1 | 0
1 0 | 0
1 1 | 0
```

### 7404 — Hex inverter

Hex inverter. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1Y` | output |
| 3 | `2A` | input |
| 4 | `2Y` | output |
| 5 | `3A` | input |
| 6 | `3Y` | output |
| 7 | `GND` | ground |
| 8 | `4Y` | output |
| 9 | `4A` | input |
| 10 | `5Y` | output |
| 11 | `5A` | input |
| 12 | `6Y` | output |
| 13 | `6A` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT A
A | Y
0 | 1
1 | 0
```

**Related examples**: 74-series: 74194 shift register ring counter

### 7407 — Hex buffer, open-collector outputs

Hex buffer, open-collector outputs. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1Y` | output (open collector, needs a pull-up) |
| 3 | `2A` | input |
| 4 | `2Y` | output (open collector, needs a pull-up) |
| 5 | `3A` | input |
| 6 | `3Y` | output (open collector, needs a pull-up) |
| 7 | `GND` | ground |
| 8 | `4Y` | output (open collector, needs a pull-up) |
| 9 | `4A` | input |
| 10 | `5Y` | output (open collector, needs a pull-up) |
| 11 | `5A` | input |
| 12 | `6Y` | output (open collector, needs a pull-up) |
| 13 | `6A` | input |
| 14 | `VCC` | power |

**Function**

```
Y = A (open collector: A = 0 pulls Y low, A = 1 leaves Y floating — needs a pull-up resistor)
A | Y
0 | L
1 | Z (off)
```

**Usage tips**

- Open-collector / open-drain output: it only pulls low, so it needs an external pull-up (or an LED to VCC); several outputs can be wired together (wired AND).

### 7408 — Quad 2-input AND

Quad 2-input AND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `1Y` | output |
| 4 | `2A` | input |
| 5 | `2B` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `4Y` | output |
| 12 | `4A` | input |
| 13 | `4B` | input |
| 14 | `VCC` | power |

**Function**

```
Y = A AND B
A B | Y
0 0 | 0
0 1 | 0
1 0 | 0
1 1 | 1
```

### 7410 — Triple 3-input NAND

Triple 3-input NAND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `2A` | input |
| 4 | `2B` | input |
| 5 | `2C` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `3C` | input |
| 12 | `1Y` | output |
| 13 | `1C` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A AND B AND C)
Y = 0 only when A = B = C = 1, otherwise Y = 1
```

### 7411 — Triple 3-input AND

Triple 3-input AND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `2A` | input |
| 4 | `2B` | input |
| 5 | `2C` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `3C` | input |
| 12 | `1Y` | output |
| 13 | `1C` | input |
| 14 | `VCC` | power |

**Function**

```
Y = A AND B AND C
Y = 1 only when A = B = C = 1
```

### 7420 — Dual 4-input NAND

Dual 4-input NAND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `NC` | not connected (NC) |
| 4 | `1C` | input |
| 5 | `1D` | input |
| 6 | `1Y` | output |
| 7 | `GND` | ground |
| 8 | `2Y` | output |
| 9 | `2A` | input |
| 10 | `2B` | input |
| 11 | `NC` | not connected (NC) |
| 12 | `2C` | input |
| 13 | `2D` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A AND B AND C AND D)
Y = 0 only when A = B = C = D = 1
```

**Usage tips**

- Pins marked NC are not connected internally.

### 7427 — Triple 3-input NOR

Triple 3-input NOR. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `2A` | input |
| 4 | `2B` | input |
| 5 | `2C` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `3C` | input |
| 12 | `1Y` | output |
| 13 | `1C` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A OR B OR C)
Y = 1 only when A = B = C = 0
```

### 7432 — Quad 2-input OR

Quad 2-input OR. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `1Y` | output |
| 4 | `2A` | input |
| 5 | `2B` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `4Y` | output |
| 12 | `4A` | input |
| 13 | `4B` | input |
| 14 | `VCC` | power |

**Function**

```
Y = A OR B
A B | Y
0 0 | 0
0 1 | 1
1 0 | 1
1 1 | 1
```

### 7486 — Quad 2-input exclusive-OR

Quad 2-input exclusive-OR. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `1Y` | output |
| 4 | `2A` | input |
| 5 | `2B` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `4Y` | output |
| 12 | `4A` | input |
| 13 | `4B` | input |
| 14 | `VCC` | power |

**Function**

```
Y = A XOR B
A B | Y
0 0 | 0
0 1 | 1
1 0 | 1
1 1 | 0
```

### 7414 — Hex Schmitt-trigger inverter

Hex Schmitt-trigger inverter. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1Y` | output |
| 3 | `2A` | input |
| 4 | `2Y` | output |
| 5 | `3A` | input |
| 6 | `3Y` | output |
| 7 | `GND` | ground |
| 8 | `4Y` | output |
| 9 | `4A` | input |
| 10 | `5Y` | output |
| 11 | `5A` | input |
| 12 | `6Y` | output |
| 13 | `6A` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT A with hysteresis: Y goes low when A rises above VT+, high when A falls below VT−
A | Y
0 | 1
1 | 0
```

**Usage tips**

- Schmitt-trigger inputs clean up slow or noisy signals; with an RC network they make an oscillator (see the example).

**Related examples**: 74-series: 7414 Schmitt-trigger RC oscillator

### 74132 — Quad 2-input Schmitt-trigger NAND

Quad 2-input Schmitt-trigger NAND. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1A` | input |
| 2 | `1B` | input |
| 3 | `1Y` | output |
| 4 | `2A` | input |
| 5 | `2B` | input |
| 6 | `2Y` | output |
| 7 | `GND` | ground |
| 8 | `3Y` | output |
| 9 | `3A` | input |
| 10 | `3B` | input |
| 11 | `4Y` | output |
| 12 | `4A` | input |
| 13 | `4B` | input |
| 14 | `VCC` | power |

**Function**

```
Y = NOT (A AND B) with hysteresis on both inputs
A B | Y
0 0 | 1
0 1 | 1
1 0 | 1
1 1 | 0
```

**Usage tips**

- Schmitt-trigger inputs clean up slow or noisy signals; with an RC network they make an oscillator (see the example).

## Flip-flops and latches

### 7474 — Dual D flip-flop with preset and clear

Dual D flip-flop with preset and clear. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1CLR` | input |
| 2 | `1D` | input |
| 3 | `1CLK` | input |
| 4 | `/1PRE` | input |
| 5 | `1Q` | output |
| 6 | `/1Q` | output |
| 7 | `GND` | ground |
| 8 | `/2Q` | output |
| 9 | `2Q` | output |
| 10 | `/2PRE` | input |
| 11 | `2CLK` | input |
| 12 | `2D` | input |
| 13 | `/2CLR` | input |
| 14 | `VCC` | power |

**Function**

```
Q ← D on the rising edge of CLK
/PRE = 0: Q = 1 · /CLR = 0: Q = 0 (asynchronous) · both low: Q = /Q = 1
/PRE /CLR CLK D | Q /Q
0 1 x x | 1 0
1 0 x x | 0 1
0 0 x x | 1 1 (not stable)
1 1 ↑ 0 | 0 1
1 1 ↑ 1 | 1 0
1 1 0/1/↓ x | Q0 /Q0
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

**Related examples**: 74-series: 7474 clock divider (÷2 and ÷4)

### 7476 — Dual JK flip-flop with preset and clear

Dual JK flip-flop with preset and clear. DIP-16 (VCC pin 5, GND pin 13). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1CLK` | input |
| 2 | `/1PRE` | input |
| 3 | `/1CLR` | input |
| 4 | `1J` | input |
| 5 | `VCC` | power |
| 6 | `2CLK` | input |
| 7 | `/2PRE` | input |
| 8 | `/2CLR` | input |
| 9 | `2J` | input |
| 10 | `/2Q` | output |
| 11 | `2Q` | output |
| 12 | `2K` | input |
| 13 | `GND` | ground |
| 14 | `/1Q` | output |
| 15 | `1Q` | output |
| 16 | `1K` | input |

**Function**

```
J K on the falling edge of CLK: 00 hold · 01 reset (Q = 0) · 10 set (Q = 1) · 11 toggle
/PRE = 0: Q = 1 · /CLR = 0: Q = 0 (asynchronous, override the clock) · both low: Q = /Q = 1
/PRE /CLR CLK J K | Q /Q
0 1 x x x | 1 0
1 0 x x x | 0 1
1 1 ↓ 0 0 | Q0 /Q0
1 1 ↓ 0 1 | 0 1
1 1 ↓ 1 0 | 1 0
1 1 ↓ 1 1 | toggle
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

### 74112 — Dual JK negative-edge-triggered flip-flop with preset and clear

Dual JK negative-edge-triggered flip-flop with preset and clear. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1CLK` | input |
| 2 | `1K` | input |
| 3 | `1J` | input |
| 4 | `/1PRE` | input |
| 5 | `1Q` | output |
| 6 | `/1Q` | output |
| 7 | `/2Q` | output |
| 8 | `GND` | ground |
| 9 | `2Q` | output |
| 10 | `/2PRE` | input |
| 11 | `2J` | input |
| 12 | `2K` | input |
| 13 | `2CLK` | input |
| 14 | `/2CLR` | input |
| 15 | `/1CLR` | input |
| 16 | `VCC` | power |

**Function**

```
J K on the falling edge of CLK: 00 hold · 01 reset (Q = 0) · 10 set (Q = 1) · 11 toggle
/PRE = 0: Q = 1 · /CLR = 0: Q = 0 (asynchronous, override the clock) · both low: Q = /Q = 1
/PRE /CLR CLK J K | Q /Q
0 1 x x x | 1 0
1 0 x x x | 0 1
1 1 ↓ 0 0 | Q0 /Q0
1 1 ↓ 0 1 | 0 1
1 1 ↓ 1 0 | 1 0
1 1 ↓ 1 1 | toggle
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

### 74273 — Octal D flip-flop with clear

Octal D flip-flop with clear. DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/MR` | input |
| 2 | `1Q` | output |
| 3 | `1D` | input |
| 4 | `2D` | input |
| 5 | `2Q` | output |
| 6 | `3Q` | output |
| 7 | `3D` | input |
| 8 | `4D` | input |
| 9 | `4Q` | output |
| 10 | `GND` | ground |
| 11 | `CP` | input |
| 12 | `5Q` | output |
| 13 | `5D` | input |
| 14 | `6D` | input |
| 15 | `6Q` | output |
| 16 | `7Q` | output |
| 17 | `7D` | input |
| 18 | `8D` | input |
| 19 | `8Q` | output |
| 20 | `VCC` | power |

**Function**

```
nQ ← nD on the rising edge of CP; /MR = 0 clears all outputs asynchronously
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

### 74373 — Octal transparent latch with 3-state outputs

Octal transparent latch with 3-state outputs. DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/OE` | input |
| 2 | `1Q` | output (3-state) |
| 3 | `1D` | input |
| 4 | `2D` | input |
| 5 | `2Q` | output (3-state) |
| 6 | `3Q` | output (3-state) |
| 7 | `3D` | input |
| 8 | `4D` | input |
| 9 | `4Q` | output (3-state) |
| 10 | `GND` | ground |
| 11 | `LE` | input |
| 12 | `5Q` | output (3-state) |
| 13 | `5D` | input |
| 14 | `6D` | input |
| 15 | `6Q` | output (3-state) |
| 16 | `7Q` | output (3-state) |
| 17 | `7D` | input |
| 18 | `8D` | input |
| 19 | `8Q` | output (3-state) |
| 20 | `VCC` | power |

**Function**

```
LE = 1: nQ follows nD (transparent) · LE = 0: nQ holds the value that nD had when LE fell
/OE = 1: all outputs high-impedance (the latch contents are kept)
/OE LE D | Q
1 x x | Z
0 1 0 | 0
0 1 1 | 1
0 0 x | Q0
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

**Related examples**: 74-series: 74373 latch on a shared bus

### 74573 — Octal transparent latch with 3-state outputs (flow-through pin-out)

Octal transparent latch with 3-state outputs (flow-through pin-out). DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/OE` | input |
| 2 | `1D` | input |
| 3 | `2D` | input |
| 4 | `3D` | input |
| 5 | `4D` | input |
| 6 | `5D` | input |
| 7 | `6D` | input |
| 8 | `7D` | input |
| 9 | `8D` | input |
| 10 | `GND` | ground |
| 11 | `LE` | input |
| 12 | `8Q` | output (3-state) |
| 13 | `7Q` | output (3-state) |
| 14 | `6Q` | output (3-state) |
| 15 | `5Q` | output (3-state) |
| 16 | `4Q` | output (3-state) |
| 17 | `3Q` | output (3-state) |
| 18 | `2Q` | output (3-state) |
| 19 | `1Q` | output (3-state) |
| 20 | `VCC` | power |

**Function**

```
Same function as the 74373 (LE = 1 transparent, LE = 0 hold, /OE = 1 high-Z) with inputs on one side and outputs on the other
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

### 74574 — Octal D flip-flop with 3-state outputs (flow-through pin-out)

Octal D flip-flop with 3-state outputs (flow-through pin-out). DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/OE` | input |
| 2 | `1D` | input |
| 3 | `2D` | input |
| 4 | `3D` | input |
| 5 | `4D` | input |
| 6 | `5D` | input |
| 7 | `6D` | input |
| 8 | `7D` | input |
| 9 | `8D` | input |
| 10 | `GND` | ground |
| 11 | `CLK` | input |
| 12 | `8Q` | output (3-state) |
| 13 | `7Q` | output (3-state) |
| 14 | `6Q` | output (3-state) |
| 15 | `5Q` | output (3-state) |
| 16 | `4Q` | output (3-state) |
| 17 | `3Q` | output (3-state) |
| 18 | `2Q` | output (3-state) |
| 19 | `1Q` | output (3-state) |
| 20 | `VCC` | power |

**Function**

```
nQ ← nD on the rising edge of CLK; /OE = 1: outputs high-impedance (contents kept)
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

### 7475 — 4-bit bistable latch

4-bit bistable latch. DIP-16 (VCC pin 5, GND pin 12). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1Q` | output |
| 2 | `1D` | input |
| 3 | `2D` | input |
| 4 | `C34` | input |
| 5 | `VCC` | power |
| 6 | `3D` | input |
| 7 | `4D` | input |
| 8 | `/4Q` | output |
| 9 | `4Q` | output |
| 10 | `3Q` | output |
| 11 | `/3Q` | output |
| 12 | `GND` | ground |
| 13 | `C12` | input |
| 14 | `/2Q` | output |
| 15 | `2Q` | output |
| 16 | `1Q` | output |

**Function**

```
C12 enables latches 1–2, C34 enables latches 3–4: C = 1: Q follows D · C = 0: Q holds
D C | Q /Q
0 1 | 0 1
1 1 | 1 0
x 0 | Q0 /Q0
```

## Counters

### 7490 — Decade counter (divide-by-2 and divide-by-5)

Decade counter (divide-by-2 and divide-by-5). DIP-14 (VCC pin 5, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `CKB` | input |
| 2 | `R0(1)` | input |
| 3 | `R0(2)` | input |
| 4 | `NC` | not connected (NC) |
| 5 | `VCC` | power |
| 6 | `R9(1)` | input |
| 7 | `R9(2)` | input |
| 8 | `QC` | output |
| 9 | `QB` | output |
| 10 | `GND` | ground |
| 11 | `QD` | output |
| 12 | `QA` | output |
| 13 | `NC` | not connected (NC) |
| 14 | `CKA` | input |

**Function**

```
CKA ↓ toggles QA (÷2); CKB ↓ counts QB–QD through 0…4 (÷5). Connect QA to CKB for BCD 0…9 (QD QC QB QA).
R0(1) = R0(2) = 1: outputs 0000 · R9(1) = R9(2) = 1: outputs 1001 (R9 has priority)
BCD count: 0000 0001 0010 0011 0100 0101 0110 0111 1000 1001 → 0000
```

**Usage tips**

- Pins marked NC are not connected internally.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

**Related examples**: 74-series: 555 → 7490 → 7447 → 7-segment display (decade counter)

### 7493 — 4-bit binary counter (divide-by-2 and divide-by-8)

4-bit binary counter (divide-by-2 and divide-by-8). DIP-14 (VCC pin 5, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `CKB` | input |
| 2 | `R0(1)` | input |
| 3 | `R0(2)` | input |
| 4 | `NC` | not connected (NC) |
| 5 | `VCC` | power |
| 6 | `NC` | not connected (NC) |
| 7 | `NC` | not connected (NC) |
| 8 | `QC` | output |
| 9 | `QB` | output |
| 10 | `GND` | ground |
| 11 | `QD` | output |
| 12 | `QA` | output |
| 13 | `NC` | not connected (NC) |
| 14 | `CKA` | input |

**Function**

```
CKA ↓ toggles QA (÷2); CKB ↓ counts QB–QD through 0…7 (÷8). Connect QA to CKB for a 4-bit binary counter (QD QC QB QA = 0000 … 1111).
R0(1) = R0(2) = 1: outputs 0000
```

**Usage tips**

- Pins marked NC are not connected internally.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

**Related examples**: 74-series: 4-bit ripple counter (7493 + LEDs)

### 74160 — Synchronous decade counter, asynchronous clear

Synchronous decade counter, asynchronous clear. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/CLR` | input |
| 2 | `CLK` | input |
| 3 | `A` | input |
| 4 | `B` | input |
| 5 | `C` | input |
| 6 | `D` | input |
| 7 | `ENP` | input |
| 8 | `GND` | ground |
| 9 | `/LOAD` | input |
| 10 | `ENT` | input |
| 11 | `QD` | output |
| 12 | `QC` | output |
| 13 | `QB` | output |
| 14 | `QA` | output |
| 15 | `RCO` | output |
| 16 | `VCC` | power |

**Function**

```
On the rising edge of CLK: /LOAD = 0 loads A–D; else if ENP = ENT = 1 the counter increments (0…9, then 0)
/CLR = 0 clears immediately (asynchronous)
RCO = ENT AND (count = 9) — connect RCO to ENT of the next stage to cascade
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74161 — Synchronous 4-bit binary counter, asynchronous clear

Synchronous 4-bit binary counter, asynchronous clear. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/CLR` | input |
| 2 | `CLK` | input |
| 3 | `A` | input |
| 4 | `B` | input |
| 5 | `C` | input |
| 6 | `D` | input |
| 7 | `ENP` | input |
| 8 | `GND` | ground |
| 9 | `/LOAD` | input |
| 10 | `ENT` | input |
| 11 | `QD` | output |
| 12 | `QC` | output |
| 13 | `QB` | output |
| 14 | `QA` | output |
| 15 | `RCO` | output |
| 16 | `VCC` | power |

**Function**

```
On the rising edge of CLK: /LOAD = 0 loads A–D; else if ENP = ENT = 1 the counter increments (0…15, then 0)
/CLR = 0 clears immediately (asynchronous)
RCO = ENT AND (count = 15) — connect RCO to ENT of the next stage to cascade
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

**Related examples**: 74-series: 74161 synchronous counter with LEDs

### 74162 — Synchronous decade counter, synchronous clear

Synchronous decade counter, synchronous clear. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/CLR` | input |
| 2 | `CLK` | input |
| 3 | `A` | input |
| 4 | `B` | input |
| 5 | `C` | input |
| 6 | `D` | input |
| 7 | `ENP` | input |
| 8 | `GND` | ground |
| 9 | `/LOAD` | input |
| 10 | `ENT` | input |
| 11 | `QD` | output |
| 12 | `QC` | output |
| 13 | `QB` | output |
| 14 | `QA` | output |
| 15 | `RCO` | output |
| 16 | `VCC` | power |

**Function**

```
On the rising edge of CLK: /LOAD = 0 loads A–D; else if ENP = ENT = 1 the counter increments (0…9, then 0)
/CLR = 0 clears on the next rising clock edge (synchronous)
RCO = ENT AND (count = 9) — connect RCO to ENT of the next stage to cascade
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74163 — Synchronous 4-bit binary counter, synchronous clear

Synchronous 4-bit binary counter, synchronous clear. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/CLR` | input |
| 2 | `CLK` | input |
| 3 | `A` | input |
| 4 | `B` | input |
| 5 | `C` | input |
| 6 | `D` | input |
| 7 | `ENP` | input |
| 8 | `GND` | ground |
| 9 | `/LOAD` | input |
| 10 | `ENT` | input |
| 11 | `QD` | output |
| 12 | `QC` | output |
| 13 | `QB` | output |
| 14 | `QA` | output |
| 15 | `RCO` | output |
| 16 | `VCC` | power |

**Function**

```
On the rising edge of CLK: /LOAD = 0 loads A–D; else if ENP = ENT = 1 the counter increments (0…15, then 0)
/CLR = 0 clears on the next rising clock edge (synchronous)
RCO = ENT AND (count = 15) — connect RCO to ENT of the next stage to cascade
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74190 — Synchronous up/down decade counter (single clock, D/U)

Synchronous up/down decade counter (single clock, D/U). DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `QB` | output |
| 3 | `QA` | output |
| 4 | `/CTEN` | input |
| 5 | `D/U` | input |
| 6 | `QC` | output |
| 7 | `QD` | output |
| 8 | `GND` | ground |
| 9 | `D` | input |
| 10 | `C` | input |
| 11 | `/LOAD` | input |
| 12 | `MAX/MIN` | output |
| 13 | `/RCO` | output |
| 14 | `CLK` | input |
| 15 | `A` | input |
| 16 | `VCC` | power |

**Function**

```
/LOAD = 0 loads A–D asynchronously. Otherwise on the rising edge of CLK, when /CTEN = 0: D/U = 0 counts up, D/U = 1 counts down (0…9, wrapping).
MAX/MIN = 1 at 9 counting up / at 0 counting down · /RCO = 0 while MAX/MIN = 1, /CTEN = 0 and CLK = 0 (ripple clock for the next stage)
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74191 — Synchronous up/down 4-bit binary counter (single clock, D/U)

Synchronous up/down 4-bit binary counter (single clock, D/U). DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `QB` | output |
| 3 | `QA` | output |
| 4 | `/CTEN` | input |
| 5 | `D/U` | input |
| 6 | `QC` | output |
| 7 | `QD` | output |
| 8 | `GND` | ground |
| 9 | `D` | input |
| 10 | `C` | input |
| 11 | `/LOAD` | input |
| 12 | `MAX/MIN` | output |
| 13 | `/RCO` | output |
| 14 | `CLK` | input |
| 15 | `A` | input |
| 16 | `VCC` | power |

**Function**

```
/LOAD = 0 loads A–D asynchronously. Otherwise on the rising edge of CLK, when /CTEN = 0: D/U = 0 counts up, D/U = 1 counts down (0…15, wrapping).
MAX/MIN = 1 at 15 counting up / at 0 counting down · /RCO = 0 while MAX/MIN = 1, /CTEN = 0 and CLK = 0 (ripple clock for the next stage)
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74192 — Synchronous up/down decade counter (dual clock)

Synchronous up/down decade counter (dual clock). DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `QB` | output |
| 3 | `QA` | output |
| 4 | `DOWN` | input |
| 5 | `UP` | input |
| 6 | `QC` | output |
| 7 | `QD` | output |
| 8 | `GND` | ground |
| 9 | `D` | input |
| 10 | `C` | input |
| 11 | `/LOAD` | input |
| 12 | `/CO` | output |
| 13 | `/BO` | output |
| 14 | `CLR` | input |
| 15 | `A` | input |
| 16 | `VCC` | power |

**Function**

```
CLR = 1 clears asynchronously, /LOAD = 0 loads A–D asynchronously (CLR has priority).
Rising edge of UP (with DOWN = 1) counts up, rising edge of DOWN (with UP = 1) counts down (0…9, wrapping).
/CO = 0 at the maximum count while UP = 0 · /BO = 0 at count 0 while DOWN = 0 (connect /CO → UP and /BO → DOWN of the next stage)
```

**Usage tips**

- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74193 — Synchronous up/down 4-bit binary counter (dual clock)

Synchronous up/down 4-bit binary counter (dual clock). DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `QB` | output |
| 3 | `QA` | output |
| 4 | `DOWN` | input |
| 5 | `UP` | input |
| 6 | `QC` | output |
| 7 | `QD` | output |
| 8 | `GND` | ground |
| 9 | `D` | input |
| 10 | `C` | input |
| 11 | `/LOAD` | input |
| 12 | `/CO` | output |
| 13 | `/BO` | output |
| 14 | `CLR` | input |
| 15 | `A` | input |
| 16 | `VCC` | power |

**Function**

```
CLR = 1 clears asynchronously, /LOAD = 0 loads A–D asynchronously (CLR has priority).
Rising edge of UP (with DOWN = 1) counts up, rising edge of DOWN (with UP = 1) counts down (0…15, wrapping).
/CO = 0 at the maximum count while UP = 0 · /BO = 0 at count 0 while DOWN = 0 (connect /CO → UP and /BO → DOWN of the next stage)
```

**Usage tips**

- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### 74393 — Dual 4-bit binary ripple counter

Dual 4-bit binary ripple counter. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1CLK` | input |
| 2 | `1CLR` | input |
| 3 | `1QA` | output |
| 4 | `1QB` | output |
| 5 | `1QC` | output |
| 6 | `1QD` | output |
| 7 | `GND` | ground |
| 8 | `2QD` | output |
| 9 | `2QC` | output |
| 10 | `2QB` | output |
| 11 | `2QA` | output |
| 12 | `2CLR` | input |
| 13 | `2CLK` | input |
| 14 | `VCC` | power |

**Function**

```
Each counter increments on the falling edge of its CLK (ripple counter, QA = ÷2 … QD = ÷16); CLR = 1 clears it asynchronously
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### CD4017 — CD4017 Decade counter with 10 decoded outputs (CMOS 4000)

Decade counter with 10 decoded outputs (CMOS 4000). DIP-16 (VDD pin 16, VSS pin 8). CMOS 4000B series, 3–15 V supply; pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Fixed family: CD4000B

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `Q5` | output |
| 2 | `Q1` | output |
| 3 | `Q0` | output |
| 4 | `Q2` | output |
| 5 | `Q6` | output |
| 6 | `Q7` | output |
| 7 | `Q3` | output |
| 8 | `VSS` | ground |
| 9 | `Q8` | output |
| 10 | `Q4` | output |
| 11 | `Q9` | output |
| 12 | `CO` | output |
| 13 | `INH` | input |
| 14 | `CLK` | input |
| 15 | `RST` | input |
| 16 | `VDD` | power |

**Function**

```
Rising edge of CLK (INH = 0) advances the counter; exactly one of Q0…Q9 is high · RST = 1 returns to Q0
CO is high for counts 0–4 and low for counts 5–9 (÷10 carry output)
```

**Usage tips**

- CD4000B series: supply 3–15 V, high output resistance (about 400 Ω), long propagation delay.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

### CD4040 — CD4040 12-stage binary ripple counter (CMOS 4000)

12-stage binary ripple counter (CMOS 4000). DIP-16 (VDD pin 16, VSS pin 8). CMOS 4000B series, 3–15 V supply; pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Fixed family: CD4000B

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `Q12` | output |
| 2 | `Q6` | output |
| 3 | `Q5` | output |
| 4 | `Q7` | output |
| 5 | `Q4` | output |
| 6 | `Q3` | output |
| 7 | `Q2` | output |
| 8 | `VSS` | ground |
| 9 | `Q1` | output |
| 10 | `CLK` | input |
| 11 | `RST` | input |
| 12 | `Q9` | output |
| 13 | `Q8` | output |
| 14 | `Q10` | output |
| 15 | `Q11` | output |
| 16 | `VDD` | power |

**Function**

```
Falling edge of CLK increments the 12-bit counter (Q1 = ÷2 … Q12 = ÷4096) · RST = 1 clears all outputs
```

**Usage tips**

- CD4000B series: supply 3–15 V, high output resistance (about 400 Ω), long propagation delay.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.
- Outputs change in the data-sheet order; when cascading mind RCO / CO and the enable inputs.

## Shift registers

### 74164 — 8-bit serial-in, parallel-out shift register

8-bit serial-in, parallel-out shift register. DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `A` | input |
| 2 | `B` | input |
| 3 | `QA` | output |
| 4 | `QB` | output |
| 5 | `QC` | output |
| 6 | `QD` | output |
| 7 | `GND` | ground |
| 8 | `CLK` | input |
| 9 | `/CLR` | input |
| 10 | `QE` | output |
| 11 | `QF` | output |
| 12 | `QG` | output |
| 13 | `QH` | output |
| 14 | `VCC` | power |

**Function**

```
Rising edge of CLK: QA ← A AND B, QB ← old QA … QH ← old QG · /CLR = 0 clears all outputs asynchronously
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

### 74165 — 8-bit parallel-load, serial-out shift register

8-bit parallel-load, serial-out shift register. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/PL` | input |
| 2 | `CLK` | input |
| 3 | `E` | input |
| 4 | `F` | input |
| 5 | `G` | input |
| 6 | `H` | input |
| 7 | `/QH` | output |
| 8 | `GND` | ground |
| 9 | `QH` | output |
| 10 | `SER` | input |
| 11 | `A` | input |
| 12 | `B` | input |
| 13 | `C` | input |
| 14 | `D` | input |
| 15 | `CLKINH` | input |
| 16 | `VCC` | power |

**Function**

```
/PL = 0 loads A…H asynchronously; /PL = 1: rising edge of CLK (CLKINH = 0) shifts: QH ← old G … B ← A, A ← SER
QH = H right after the load, so the first bit shifted out is H (the MSB for shiftIn(…, MSBFIRST)); read QH, then pulse CLK.
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

**Related examples**: 74-series: Arduino shiftIn ← 74HC165 reads 8 switches

### 74194 — 4-bit bidirectional universal shift register

4-bit bidirectional universal shift register. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/CLR` | input |
| 2 | `SR` | input |
| 3 | `A` | input |
| 4 | `B` | input |
| 5 | `C` | input |
| 6 | `D` | input |
| 7 | `SL` | input |
| 8 | `GND` | ground |
| 9 | `S0` | input |
| 10 | `S1` | input |
| 11 | `CLK` | input |
| 12 | `QD` | output |
| 13 | `QC` | output |
| 14 | `QB` | output |
| 15 | `QA` | output |
| 16 | `VCC` | power |

**Function**

```
Rising edge of CLK, mode S1 S0: 00 hold · 01 shift right (QA → QB → QC → QD, SR enters QA) · 10 shift left (QD → QC → QB → QA, SL enters QD) · 11 parallel load A–D
/CLR = 0 clears asynchronously
```

**Usage tips**

- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

**Related examples**: 74-series: 74194 shift register ring counter

### 74595 — 8-bit serial-in shift register with 3-state output latch

8-bit serial-in shift register with 3-state output latch. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `QB` | output (3-state) |
| 2 | `QC` | output (3-state) |
| 3 | `QD` | output (3-state) |
| 4 | `QE` | output (3-state) |
| 5 | `QF` | output (3-state) |
| 6 | `QG` | output (3-state) |
| 7 | `QH` | output (3-state) |
| 8 | `GND` | ground |
| 9 | `QH'` | output |
| 10 | `/SRCLR` | input |
| 11 | `SRCLK` | input |
| 12 | `RCLK` | input |
| 13 | `/OE` | input |
| 14 | `SER` | input |
| 15 | `QA` | output (3-state) |
| 16 | `VCC` | power |

**Function**

```
Rising edge of SRCLK: shift register QA ← SER, QB ← old QA … · rising edge of RCLK: output register ← shift register
/OE = 1: QA…QH high-impedance · /SRCLR = 0 clears the shift register (not the output register) · QH′ = last stage of the shift register
Arduino: shiftOut(SER, SRCLK, MSBFIRST, value) then pulse RCLK — bit 7 ends up on QH
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.
- Clocked on the active edge (rising unless the data sheet says otherwise); asynchronous clear / preset override the clock.

**Related examples**: 74-series: Arduino shiftOut → 74HC595 running light

## Decoders / display drivers

### 74138 — 3-to-8 line decoder / demultiplexer

3-to-8 line decoder / demultiplexer. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `A` | input |
| 2 | `B` | input |
| 3 | `C` | input |
| 4 | `/G2A` | input |
| 5 | `/G2B` | input |
| 6 | `G1` | input |
| 7 | `/Y7` | output |
| 8 | `GND` | ground |
| 9 | `/Y6` | output |
| 10 | `/Y5` | output |
| 11 | `/Y4` | output |
| 12 | `/Y3` | output |
| 13 | `/Y2` | output |
| 14 | `/Y1` | output |
| 15 | `/Y0` | output |
| 16 | `VCC` | power |

**Function**

```
Enabled when G1 = 1 and /G2A = /G2B = 0; the output /Y(CBA) is low, all others high
C B A | /Y0 … /Y7: 000 → /Y0 low, 001 → /Y1 low, … 111 → /Y7 low · not enabled: all outputs high
```

**Related examples**: 74-series: 74138 decoder driving LEDs from switches

### 74139 — Dual 2-to-4 line decoder / demultiplexer

Dual 2-to-4 line decoder / demultiplexer. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1G` | input |
| 2 | `1A` | input |
| 3 | `1B` | input |
| 4 | `/1Y0` | output |
| 5 | `/1Y1` | output |
| 6 | `/1Y2` | output |
| 7 | `/1Y3` | output |
| 8 | `GND` | ground |
| 9 | `/2Y3` | output |
| 10 | `/2Y2` | output |
| 11 | `/2Y1` | output |
| 12 | `/2Y0` | output |
| 13 | `2B` | input |
| 14 | `2A` | input |
| 15 | `/2G` | input |
| 16 | `VCC` | power |

**Function**

```
/G = 0 enables: output /Y(BA) low, the others high · /G = 1: all four outputs high
```

### 74154 — 4-to-16 line decoder / demultiplexer

4-to-16 line decoder / demultiplexer. DIP-24 (VCC pin 24, GND pin 12). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-24 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/Y0` | output |
| 2 | `/Y1` | output |
| 3 | `/Y2` | output |
| 4 | `/Y3` | output |
| 5 | `/Y4` | output |
| 6 | `/Y5` | output |
| 7 | `/Y6` | output |
| 8 | `/Y7` | output |
| 9 | `/Y8` | output |
| 10 | `/Y9` | output |
| 11 | `/Y10` | output |
| 12 | `GND` | ground |
| 13 | `/Y11` | output |
| 14 | `/Y12` | output |
| 15 | `/Y13` | output |
| 16 | `/Y14` | output |
| 17 | `/Y15` | output |
| 18 | `/G1` | input |
| 19 | `/G2` | input |
| 20 | `D` | input |
| 21 | `C` | input |
| 22 | `B` | input |
| 23 | `A` | input |
| 24 | `VCC` | power |

**Function**

```
Enabled when /G1 = /G2 = 0; the output /Y(DCBA) is low, all others high; not enabled: all high
```

### 7447 — BCD to seven-segment decoder / driver, active-low open-collector outputs

BCD to seven-segment decoder / driver, active-low open-collector outputs. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74, 74LS (default: 74)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `C` | input |
| 3 | `/LT` | input |
| 4 | `/BI` | bidirectional (open collector) |
| 5 | `/RBI` | input |
| 6 | `D` | input |
| 7 | `A` | input |
| 8 | `GND` | ground |
| 9 | `e` | output (open collector, needs a pull-up) |
| 10 | `d` | output (open collector, needs a pull-up) |
| 11 | `c` | output (open collector, needs a pull-up) |
| 12 | `b` | output (open collector, needs a pull-up) |
| 13 | `a` | output (open collector, needs a pull-up) |
| 14 | `g` | output (open collector, needs a pull-up) |
| 15 | `f` | output (open collector, needs a pull-up) |
| 16 | `VCC` | power |

**Function**

```
Inputs D C B A (BCD 0–9, 10–15 = special symbols) select the segments a…g; /LT = 0 (with /BI high) lights all segments; /BI = 0 blanks all segments; /RBI = 0 blanks a zero and pulls /BI//RBO low (ripple blanking)
Segments on, a…g: 0 abcdef · 1 bc · 2 abdeg · 3 abcdg · 4 bcfg · 5 acdfg · 6 cdefg · 7 abc · 8 abcdefg · 9 abcfg · 10 deg · 11 cdg · 12 bfg · 13 adfg · 14 defg · 15 blank
Outputs are open collectors: a segment is ON when its output is LOW (common-anode display, series resistors needed). Sink: 40 mA (7447A) / 24 mA (74LS47).
```

**Usage tips**

- Open-collector / open-drain output: it only pulls low, so it needs an external pull-up (or an LED to VCC); several outputs can be wired together (wired AND).

**Related examples**: 74-series: 555 → 7490 → 7447 → 7-segment display (decade counter)

### 7448 — BCD to seven-segment decoder / driver, active-high outputs with 2 kΩ pull-ups

BCD to seven-segment decoder / driver, active-high outputs with 2 kΩ pull-ups. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74, 74LS (default: 74)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B` | input |
| 2 | `C` | input |
| 3 | `/LT` | input |
| 4 | `/BI` | bidirectional (open collector) |
| 5 | `/RBI` | input |
| 6 | `D` | input |
| 7 | `A` | input |
| 8 | `GND` | ground |
| 9 | `e` | output (open collector with internal 2 kΩ pull-up) |
| 10 | `d` | output (open collector with internal 2 kΩ pull-up) |
| 11 | `c` | output (open collector with internal 2 kΩ pull-up) |
| 12 | `b` | output (open collector with internal 2 kΩ pull-up) |
| 13 | `a` | output (open collector with internal 2 kΩ pull-up) |
| 14 | `g` | output (open collector with internal 2 kΩ pull-up) |
| 15 | `f` | output (open collector with internal 2 kΩ pull-up) |
| 16 | `VCC` | power |

**Function**

```
Inputs D C B A (BCD 0–9, 10–15 = special symbols) select the segments a…g; /LT = 0 (with /BI high) lights all segments; /BI = 0 blanks all segments; /RBI = 0 blanks a zero and pulls /BI//RBO low (ripple blanking)
Segments on, a…g: 0 abcdef · 1 bc · 2 abdeg · 3 abcdg · 4 bcfg · 5 acdfg · 6 cdefg · 7 abc · 8 abcdefg · 9 abcfg · 10 deg · 11 cdg · 12 bfg · 13 adfg · 14 defg · 15 blank
Outputs have internal 2 kΩ pull-ups: a segment is ON when its output is HIGH (common-cathode display, ≈ 2 mA through the pull-up). Sink 6.4 mA (7448) / 6 mA (74LS48).
```

**Usage tips**

- Open-collector / open-drain output: it only pulls low, so it needs an external pull-up (or an LED to VCC); several outputs can be wired together (wired AND).
- The output stage is open collector with a 2 kΩ pull-up in series inside: connect an LED cathode to the output with a resistor to VCC, or drive a logic input.

## Multiplexers

### 74153 — Dual 4-to-1 data selector / multiplexer

Dual 4-to-1 data selector / multiplexer. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1G` | input |
| 2 | `B` | input |
| 3 | `1C3` | input |
| 4 | `1C2` | input |
| 5 | `1C1` | input |
| 6 | `1C0` | input |
| 7 | `1Y` | output |
| 8 | `GND` | ground |
| 9 | `2Y` | output |
| 10 | `2C0` | input |
| 11 | `2C1` | input |
| 12 | `2C2` | input |
| 13 | `2C3` | input |
| 14 | `A` | input |
| 15 | `/2G` | input |
| 16 | `VCC` | power |

**Function**

```
Select inputs B A (common to both halves) choose C0…C3: Y = C(BA) when /G = 0, Y = 0 when /G = 1
```

### 74151 — 8-to-1 data selector / multiplexer

8-to-1 data selector / multiplexer. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `D3` | input |
| 2 | `D2` | input |
| 3 | `D1` | input |
| 4 | `D0` | input |
| 5 | `Y` | output |
| 6 | `W` | output |
| 7 | `/G` | input |
| 8 | `GND` | ground |
| 9 | `C` | input |
| 10 | `B` | input |
| 11 | `A` | input |
| 12 | `D7` | input |
| 13 | `D6` | input |
| 14 | `D5` | input |
| 15 | `D4` | input |
| 16 | `VCC` | power |

**Function**

```
Y = D(CBA) when /G = 0 (W = NOT Y) · /G = 1: Y = 0, W = 1
```

### 74157 — Quad 2-to-1 data selector / multiplexer

Quad 2-to-1 data selector / multiplexer. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `A/B` | input |
| 2 | `1A` | input |
| 3 | `1B` | input |
| 4 | `1Y` | output |
| 5 | `2A` | input |
| 6 | `2B` | input |
| 7 | `2Y` | output |
| 8 | `GND` | ground |
| 9 | `3Y` | output |
| 10 | `3B` | input |
| 11 | `3A` | input |
| 12 | `4Y` | output |
| 13 | `4B` | input |
| 14 | `4A` | input |
| 15 | `/G` | input |
| 16 | `VCC` | power |

**Function**

```
A/B = 0 selects the A inputs, A/B = 1 the B inputs; /G = 1 forces all Y low
```

## Arithmetic / comparison

### 7483 — 4-bit binary full adder with fast carry

4-bit binary full adder with fast carry. DIP-16 (VCC pin 5, GND pin 12). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `A4` | input |
| 2 | `S3` | output |
| 3 | `A3` | input |
| 4 | `B3` | input |
| 5 | `VCC` | power |
| 6 | `S2` | output |
| 7 | `B2` | input |
| 8 | `A2` | input |
| 9 | `S1` | output |
| 10 | `A1` | input |
| 11 | `B1` | input |
| 12 | `GND` | ground |
| 13 | `C0` | input |
| 14 | `C4` | output |
| 15 | `S4` | output |
| 16 | `B4` | input |

**Function**

```
C4 S4 S3 S2 S1 = A4…A1 + B4…B1 + C0 (A1, B1, S1 are the least significant bits)
```

**Related examples**: 74-series: 7483 4-bit adder (switches and LEDs)

### 7485 — 4-bit magnitude comparator

4-bit magnitude comparator. DIP-16 (VCC pin 16, GND pin 8). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-16 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74LS)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `B3` | input |
| 2 | `A<B` | input |
| 3 | `A=B` | input |
| 4 | `A>B` | input |
| 5 | `OA>B` | output |
| 6 | `OA=B` | output |
| 7 | `OA<B` | output |
| 8 | `GND` | ground |
| 9 | `B0` | input |
| 10 | `A0` | input |
| 11 | `B1` | input |
| 12 | `A1` | input |
| 13 | `A2` | input |
| 14 | `B2` | input |
| 15 | `A3` | input |
| 16 | `VCC` | power |

**Function**

```
A > B: OA>B = 1 · A < B: OA<B = 1 · A = B: the cascade inputs decide (A=B high → OA=B = 1; A>B high → OA>B = 1; A<B high → OA<B = 1)
For a single stage tie A=B to VCC and A>B, A<B to GND
```

**Related examples**: 74-series: 7485 4-bit comparator

## Bus drivers

### 74244 — Octal buffer / line driver with 3-state outputs

Octal buffer / line driver with 3-state outputs. DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1G` | input |
| 2 | `1A1` | input |
| 3 | `2Y4` | output (3-state) |
| 4 | `1A2` | input |
| 5 | `2Y3` | output (3-state) |
| 6 | `1A3` | input |
| 7 | `2Y2` | output (3-state) |
| 8 | `1A4` | input |
| 9 | `2Y1` | output (3-state) |
| 10 | `GND` | ground |
| 11 | `2A1` | input |
| 12 | `1Y4` | output (3-state) |
| 13 | `2A2` | input |
| 14 | `1Y3` | output (3-state) |
| 15 | `2A3` | input |
| 16 | `1Y2` | output (3-state) |
| 17 | `2A4` | input |
| 18 | `1Y1` | output (3-state) |
| 19 | `/2G` | input |
| 20 | `VCC` | power |

**Function**

```
Two groups of four non-inverting buffers: nY = nA when /nG = 0, high-impedance when /nG = 1
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

### 74245 — Octal bus transceiver with 3-state outputs

Octal bus transceiver with 3-state outputs. DIP-20 (VCC pin 20, GND pin 10). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-20 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `DIR` | input |
| 2 | `A1` | bidirectional (3-state) |
| 3 | `A2` | bidirectional (3-state) |
| 4 | `A3` | bidirectional (3-state) |
| 5 | `A4` | bidirectional (3-state) |
| 6 | `A5` | bidirectional (3-state) |
| 7 | `A6` | bidirectional (3-state) |
| 8 | `A7` | bidirectional (3-state) |
| 9 | `A8` | bidirectional (3-state) |
| 10 | `GND` | ground |
| 11 | `B8` | bidirectional (3-state) |
| 12 | `B7` | bidirectional (3-state) |
| 13 | `B6` | bidirectional (3-state) |
| 14 | `B5` | bidirectional (3-state) |
| 15 | `B4` | bidirectional (3-state) |
| 16 | `B3` | bidirectional (3-state) |
| 17 | `B2` | bidirectional (3-state) |
| 18 | `B1` | bidirectional (3-state) |
| 19 | `/OE` | input |
| 20 | `VCC` | power |

**Function**

```
/OE = 1: both sides high-impedance (isolated) · /OE = 0 and DIR = 1: A → B · /OE = 0 and DIR = 0: B → A
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

**Related examples**: 74-series: 74245 bus transceiver (switches and LEDs)

### 74125 — Quad bus buffer with 3-state outputs (active-low enables)

Quad bus buffer with 3-state outputs (active-low enables). DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `/1G` | input |
| 2 | `1A` | input |
| 3 | `1Y` | output (3-state) |
| 4 | `/2G` | input |
| 5 | `2A` | input |
| 6 | `2Y` | output (3-state) |
| 7 | `GND` | ground |
| 8 | `3Y` | output (3-state) |
| 9 | `3A` | input |
| 10 | `/3G` | input |
| 11 | `4Y` | output (3-state) |
| 12 | `4A` | input |
| 13 | `/4G` | input |
| 14 | `VCC` | power |

**Function**

```
Four independent 3-state buffers: Y = A when /G = 0, high-impedance otherwise
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

### 74126 — Quad bus buffer with 3-state outputs (active-high enables)

Quad bus buffer with 3-state outputs (active-high enables). DIP-14 (VCC pin 14, GND pin 7). Family selectable (74HC / 74HCT / 74LS / 74): sets supply range, input thresholds and output drive. Pin-out as in the manufacturer datasheet.

- Package: DIP-14 · Selectable families: 74HC, 74HCT, 74LS, 74 (default: 74HC)

| Pin | Name | Direction / note |
|---|---|---|
| 1 | `1G` | input |
| 2 | `1A` | input |
| 3 | `1Y` | output (3-state) |
| 4 | `2G` | input |
| 5 | `2A` | input |
| 6 | `2Y` | output (3-state) |
| 7 | `GND` | ground |
| 8 | `3Y` | output (3-state) |
| 9 | `3A` | input |
| 10 | `3G` | input |
| 11 | `4Y` | output (3-state) |
| 12 | `4A` | input |
| 13 | `4G` | input |
| 14 | `VCC` | power |

**Function**

```
Four independent 3-state buffers: Y = A when G = 1, high-impedance otherwise
```

**Usage tips**

- 3-state outputs: high-Z when disabled; never enable two outputs on one bus at the same time.

## Examples

- 74-series: SR latch from two 7400 NAND gates (7400)
- 74-series: 4-bit ripple counter (7493 + LEDs) (7493)
- 74-series: 555 → 7490 → 7447 → 7-segment display (decade counter) (7490, 7447)
- 74-series: 74161 synchronous counter with LEDs (74161)
- 74-series: 74138 decoder driving LEDs from switches (74138)
- 74-series: Arduino shiftOut → 74HC595 running light (74595)
- 74-series: Arduino shiftIn ← 74HC165 reads 8 switches (74165)
- 74-series: 74373 latch on a shared bus (74373)
- 74-series: 74245 bus transceiver (switches and LEDs) (74245)
- 74-series: 7483 4-bit adder (switches and LEDs) (7483)
- 74-series: 7485 4-bit comparator (7485)
- 74-series: 74194 shift register ring counter (74194, 7404)
- 74-series: 7414 Schmitt-trigger RC oscillator (7414)
- 74-series: 7474 clock divider (÷2 and ÷4) (7474)

## Data-sheet verification notes

- Pin-outs come from the manufacturers' data sheets (TI SN7400 / SN74LS / SN74HC series, Nexperia / Philips, onsemi CD4017B / CD4040B).
- The 7447 draws digits 6 and 9 as in the original 7447A (6 without the top bar, 9 without the bottom bar), which differs from some modern 7447-compatible chips.
- 74LS48 and 7448 are one part (search "LS48"). The /RBI, /BI and /LT logic follows the data-sheet function table; the internal pull-up details are not modelled.
- Propagation delays, output resistances and input resistances are rounded from data-sheet typicals and are for demonstration only.
- Not included: 74266 / 7403 (OC NAND / XNOR), 74147 / 74148 (priority encoders), 74181 (ALU). A 4-digit multiplexed 7-segment display (12-pin, 5641AS / 3641AS pin-out) was added to the lighting category.
