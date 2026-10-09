# 单片机引脚说明、常规用法与示例

> 本文件由 `tools/gen-pinout-docs.js` 根据程序内「引脚说明」面板的同一份数据生成，内容与面板一致。  
> 在程序中：选中开发板或芯片 → 属性面板或程序编辑器工具栏中的「📌 引脚说明」；示例也在顶部「示例电路」菜单中。  
> [English version](pinout-en.md)

## 目录

- [Arduino Uno 开发板](#arduino)
- [ATtiny85 单片机 (8 脚)](#attiny85)
- [常规用法](#usage)
- [传感器](#sensors)
- [示例](#examples)

<a id="arduino"></a>

## Arduino Uno 开发板

Arduino Uno R3（ATmega328P，16 MHz，5 V 逻辑）：14 个数字引脚 D0–D13（其中 6 个带 ~ 可输出 PWM），6 个模拟输入 A0–A5（10 位 ADC，也可当数字脚 D14–D19）。下面依次是引脚图、每个引脚的功能、电气极限、仿真支持情况、常规用法，最后是可一键载入的示例。

### 引脚图

![Arduino Uno 开发板](pinout-uno.svg)

`数字 IO` · `PWM 输出` · `模拟输入` · `通信 (UART/SPI/I²C)` · `外部中断` · `电源` · `地` · `特殊功能` — 虚线框 = 仿真器未模拟

### 引脚表

| 引脚 | 端口 / 数据手册名称 | 功能与说明 | 仿真 |
|---|---|---|---|
| **D0** | PD0 · RXD | 数字输入/输出, ~~串口接收 RX~~<br>D0/D1 与板上的 USB 转串口芯片相连：上传程序和 `Serial` 通信都要用它们，外接电路可能导致上传失败。仿真中 D0/D1 可当普通 IO，`Serial` 直接连到串口监视器。 | ◐ 部分支持 |
| **D1** | PD1 · TXD | 数字输入/输出, ~~串口发送 TX~~ | ◐ 部分支持 |
| **D2** | PD2 · INT0 | 数字输入/输出, ~~外部中断 INT0~~ | ◐ 部分支持 |
| **D3 ~** | PD3 · OC2B · INT1 | 数字输入/输出, PWM 约 490 Hz, ~~外部中断 INT1~~<br>`tone()` 占用 Timer2，发声期间 D3 和 D11 的 PWM 失效。 | ◐ 部分支持 |
| **D4** | PD4 | 数字输入/输出 | ✓ 支持 |
| **D5 ~** | PD5 · OC0B | 数字输入/输出, PWM 约 980 Hz | ✓ 支持 |
| **D6 ~** | PD6 · OC0A | 数字输入/输出, PWM 约 980 Hz | ✓ 支持 |
| **D7** | PD7 | 数字输入/输出 | ✓ 支持 |
| **D8** | PB0 | 数字输入/输出 | ✓ 支持 |
| **D9 ~** | PB1 · OC1A | 数字输入/输出, PWM 约 490 Hz<br>Servo 库占用 Timer1，使用后 D9 和 D10 都不能再 `analogWrite()`（与舵机接在哪个脚无关）。 | ✓ 支持 |
| **D10 ~** | PB2 · OC1B · SS | 数字输入/输出, PWM 约 490 Hz, ~~SPI 片选 SS~~ | ◐ 部分支持 |
| **D11 ~** | PB3 · OC2A · MOSI | 数字输入/输出, PWM 约 490 Hz, ~~SPI 主出从入 MOSI~~<br>`tone()` 占用 Timer2，发声期间 D3 和 D11 的 PWM 失效。 | ◐ 部分支持 |
| **D12** | PB4 · MISO | 数字输入/输出, ~~SPI 主入从出 MISO~~ | ◐ 部分支持 |
| **D13** | PB5 · SCK | 数字输入/输出, ~~SPI 时钟 SCK~~, 板载 LED「L」<br>板载 LED「L」由 D13（`LED_BUILTIN`）驱动，R3 上经运放缓冲。D13 同时是 SPI 的 SCK，使用 SPI 时 LED 会闪。 | ◐ 部分支持 |
| **A0 (D14)** | PC0 · ADC0 | 模拟输入（10 位 ADC）, 数字输入/输出 | ✓ 支持 |
| **A1 (D15)** | PC1 · ADC1 | 模拟输入（10 位 ADC）, 数字输入/输出 | ✓ 支持 |
| **A2 (D16)** | PC2 · ADC2 | 模拟输入（10 位 ADC）, 数字输入/输出 | ✓ 支持 |
| **A3 (D17)** | PC3 · ADC3 | 模拟输入（10 位 ADC）, 数字输入/输出 | ✓ 支持 |
| **A4 (D18)** | PC4 · ADC4 · SDA | 模拟输入（10 位 ADC）, 数字输入/输出, ~~I²C 数据 SDA~~<br>A4/A5 同时是 I²C 的 SDA/SCL（R3 在 AREF 旁另有一组 SDA/SCL 排针，与 A4/A5 内部相连）。使用 I²C 时它们不能再作模拟输入。 | ◐ 部分支持 |
| **A5 (D19)** | PC5 · ADC5 · SCL | 模拟输入（10 位 ADC）, 数字输入/输出, ~~I²C 时钟 SCL~~ | ◐ 部分支持 |
| **5V** |  | 5 V 电源<br>来自板载 5 V 稳压器（VIN/DC 供电时）或 USB。可给传感器和小模块供电；USB 供电时全板受 500 mA 自恢复保险丝限制。也能从这里输入稳压的 5 V，但会绕过稳压器和保护电路。 | ✓ 支持 |
| **3.3V** |  | 3.3 V 电源输出<br>板载 3.3 V 稳压输出，最大 50 mA。 | ✓ 支持 |
| **VIN** |  | 外部电源输入 VIN<br>外部电源输入（DC 插座经二极管接到这里），推荐 7–12 V，极限 6–20 V。低于 7 V 时 5 V 可能不稳，高于 12 V 稳压器容易过热。 | ✓ 支持 |
| **GND ×3** |  | 地 GND<br>所有 GND 相互连通。外部电源（电池、电机电源）的负极必须与 Arduino 的 GND 相连（共地），信号才有共同的参考。 | ✓ 支持 |
| **RESET** | PC6 | ~~复位（低电平有效）~~<br>拉低即复位，板上的复位按钮也接在这里。仿真元件没有此脚，可用程序编辑器里的「复位」按钮代替。 | — 元件上无此脚 |
| **AREF** | AREF | ~~模拟参考电压 AREF~~<br>外部模拟参考电压输入（0–5 V），配合 `analogReference(EXTERNAL)` 使用；接外部电压前必须先设为 EXTERNAL，否则可能损坏芯片。仿真元件没有此脚，EXTERNAL 按 VCC (5 V) 处理。 | — 元件上无此脚 |
| **IOREF** |  | ~~IO 电平参考 IOREF~~<br>告诉扩展板本板的 IO 电平（Uno 上接 5 V）。仿真元件没有此脚。 | — 元件上无此脚 |
| **SDA / SCL** | = A4 / A5 | ~~I²C 数据 SDA~~, ~~I²C 时钟 SCL~~<br>R3 新增的 I²C 排针，与 A4/A5 电气上相同。仿真器不支持 I²C（Wire 库）。 | — 元件上无此脚 |
| **ICSP** | MISO · SCK · MOSI · RESET · 5V · GND | ~~ICSP 在线编程接口~~<br>6 针 ISP 在线编程接口，用于烧写引导程序或用编程器直接下载程序。仿真中不需要。 | — 元件上无此脚 |

~~外部中断 INT0~~ = 不支持

### 电气极限

- 每个 IO 引脚：推荐 ≤ 20 mA，绝对最大 40 mA，超过可能永久损坏端口。
- 所有引脚电流之和（VCC/GND 总电流）不超过 200 mA。
- 引脚电压不得超出 −0.5 V … VCC + 0.5 V；输入低电平 < 0.3·VCC（1.5 V），高电平 > 0.6·VCC（3 V）。
- 内部上拉电阻 20–50 kΩ（`INPUT_PULLUP`）。
- 模拟输入 0–5 V（默认参考 = VCC），10 位 → 0–1023，每档约 4.9 mV；信号源阻抗建议 ≤ 10 kΩ。
- VIN / DC 插座：推荐 7–12 V，极限 6–20 V；USB 供电为 5 V，带 500 mA 自恢复保险丝。
- 3.3V 引脚最大 50 mA；5V 引脚能给出多少电流取决于电源（USB 时全板 ≤ 500 mA，VIN 供电时受稳压器发热限制）。
- ATmega328P：16 MHz，Flash 32 KB（引导程序占 0.5 KB），SRAM 2 KB，EEPROM 1 KB。

<a id="attiny85"></a>

## ATtiny85 单片机 (8 脚)

ATtiny85（8 脚 DIP，AVR 8 位）：5 个通用 IO PB0–PB4，另有 PB5（默认是 RESET）。没有硬件串口；PWM 在 PB0/PB1/PB4，ADC 在 PB2/PB3/PB4（PB5 也可）。Flash 8 KB、SRAM 512 B、EEPROM 512 B；出厂默认内部 8 MHz RC 振荡器 8 分频 = 1 MHz（CKDIV8 熔丝）。

### 引脚图

![ATtiny85 单片机 (8 脚)](pinout-attiny85.svg)

`数字 IO` · `PWM 输出` · `模拟输入` · `通信 (UART/SPI/I²C)` · `外部中断` · `电源` · `地` · `特殊功能` — 虚线框 = 仿真器未模拟

### 引脚表

| 引脚 | 端口 / 数据手册名称 | 功能与说明 | 仿真 |
|---|---|---|---|
| **1 · PB5** | PCINT5 · RESET · ADC0 · dW | 复位 RESET（低电平有效）, 模拟输入（10 位 ADC）, 数字输入/输出<br>默认是 RESET（低电平复位，内部上拉），不能当普通 IO；仿真中把它拉到 0.3·VCC 以下会让芯片保持复位。烧写 RSTDISBL 熔丝后才成为（驱动能力较弱的）IO，但之后不能再用 ISP 编程，需要高压编程器才能恢复。仿真中可在属性里勾选「PB5 作普通 IO」。 | ✓ 支持 |
| **2 · PB3** | PCINT3 · XTAL1 · CLKI · OC1B̅ · ADC3 | 数字输入/输出, 模拟输入（10 位 ADC）, ~~外部晶振引脚~~<br>PB3/PB4 也是外部晶振引脚：使用外部晶振时不能当 IO。默认使用内部 RC 振荡器，所以可以自由使用。 | ◐ 部分支持 |
| **3 · PB4** | PCINT4 · XTAL2 · CLKO · OC1B · ADC2 | 数字输入/输出, PWM 输出 (analogWrite), 模拟输入（10 位 ADC）, ~~外部晶振引脚~~ | ◐ 部分支持 |
| **4 · GND** |  | 地 GND | ✓ 支持 |
| **5 · PB0** | MOSI · DI · SDA · AIN0 · OC0A · OC1A̅ · AREF · PCINT0 | 数字输入/输出, PWM 输出 (analogWrite), ~~USI 数据输入 DI / I²C SDA~~, ~~SPI 主出从入 MOSI~~, ~~模拟比较器输入~~, ~~外部参考电压 AREF~~<br>物理第 5 脚：PWM (OC0A)、USI 的 DI / I²C SDA、ISP 编程的 MOSI，也可作外部 AREF（此时不能再作 IO）。 | ◐ 部分支持 |
| **6 · PB1** | MISO · DO · AIN1 · OC0B · OC1A · PCINT1 | 数字输入/输出, PWM 输出 (analogWrite), ~~USI 数据输出 DO~~, ~~SPI 主入从出 MISO~~, ~~模拟比较器输入~~, Digispark 等板的板载 LED<br>物理第 6 脚：PWM (OC0B / OC1A)、USI 的 DO、ISP 编程的 MISO。Digispark 等开发板的板载 LED 接在这里。 | ◐ 部分支持 |
| **7 · PB2** | SCK · USCK · SCL · ADC1 · T0 · INT0 · PCINT2 | 数字输入/输出, 模拟输入（10 位 ADC）, ~~USI 时钟 USCK / I²C SCL~~, ~~SPI 时钟 SCK~~, ~~外部中断 INT0~~<br>物理第 7 脚：唯一的外部中断 INT0、模拟输入 A1 (ADC1)、USI 时钟 USCK / I²C SCL、ISP 编程的 SCK。 | ◐ 部分支持 |
| **8 · VCC** |  | 电源 VCC<br>供电 2.7–5.5 V（ATtiny85V 为 1.8–5.5 V），时钟越高需要的电压越高（20 MHz 需 4.5 V 以上）。VCC 与 GND 之间就近接 100 nF 去耦电容。 | ✓ 支持 |

~~外部晶振引脚~~ = 不支持

### 电气极限

- 每个 IO 引脚：建议 ≤ 20 mA，绝对最大 40 mA；VCC/GND 总电流 ≤ 200 mA。
- 工作电压 2.7–5.5 V（ATtiny85V：1.8–5.5 V）；10 MHz 以下 2.7 V 即可，20 MHz 需要 4.5–5.5 V。
- 引脚电压 −0.5 V … VCC + 0.5 V；内部上拉 20–50 kΩ。
- ADC：10 位，4 路单端输入 ADC0–ADC3 = PB5 / PB2 / PB4 / PB3；参考电压可选 VCC、内部 1.1 V、内部 2.56 V 或 PB0 上的外部 AREF。
- 存储：Flash 8 KB、SRAM 512 B、EEPROM 512 B。
- 时钟：出厂为内部 8 MHz RC ÷ 8 = 1 MHz（CKDIV8 熔丝）；可改为内部 8 MHz、PLL 16 MHz，或外部晶振（占用 PB3/PB4）。

## 仿真支持

✓ 仿真支持：`pinMode` / `digitalWrite` / `digitalRead`（含 `INPUT_PULLUP`）、`analogRead`（10 位）、`analogWrite`（PWM 频率与真实芯片一致）、`millis` / `micros` / `delay`、`tone` / `noTone`、`pulseIn`、`shiftOut`、Servo、LiquidCrystal、LiquidCrystal_I2C、DHT、OneWire + DallasTemperature、`Serial`（串口监视器）等。引脚的输出电阻、上拉电阻和电流都参与电路求解，单脚超过 40 mA 会给出警告。

- ✗ 外部中断 `attachInterrupt()`：编译时提示不支持，请改用轮询或 `millis()`。
- ✗ SPI 库、串口的引脚级时序以及通用 I²C：D0/D1、D10–D13 的通信功能不模拟，`Serial` 只连接串口监视器；A4/A5 上的 I²C 只支持 I2C 液晶屏 (LiquidCrystal_I2C，库函数层面)，`Wire` 只支持 begin / beginTransmission / write / endTransmission。
- ✗ 库对定时器的副作用（tone 使 D3/D11 的 PWM 失效、Servo 使 D9/D10 的 PWM 失效）只在说明中提示，仿真中不会出现。
- ✗ Uno 元件没有 RESET、AREF、IOREF、单独的 SDA/SCL 排针和 ICSP 接口；`analogReference(EXTERNAL)` 按 VCC 处理，`INTERNAL` = 1.1 V。
- ✗ ATtiny85 没有硬件串口：仿真中的 `Serial` 是虚拟的，只用于把调试信息输出到串口监视器。
- ✗ 引脚过流不会「烧坏」芯片：仿真只给出警告，请对照电气极限自行检查。
- ✗ EEPROM、睡眠模式、看门狗、熔丝设置以及直接操作寄存器（如 `PORTB`、`DDRB`）不支持。
- ✗ 不模拟指令执行时间：代码视为瞬间完成，只有 `delay()`、`millis()` 等推动时间；死循环超过运算上限会报错。

<a id="usage"></a>

## 常规用法

每一节给出接线要点和一段可以直接复制的代码，并链接到相关示例。

### 供电方式

Uno 有三种供电方式：① USB 5 V（最简单，全板 ≤ 500 mA）；② DC 插座或 VIN 接 7–12 V，经板载稳压器得到 5 V；③ 直接向 5V 引脚输入稳压的 5 V（绕过稳压器和保护，接错会损坏板子）。仿真中可在属性里选择 USB 或 VIN 供电。

5V 和 3.3V 引脚可以给传感器、小模块供电，但不要用它们驱动电机、多个舵机或大功率 LED：这些负载会拉低电压，使单片机复位。大电流负载请用独立电源，并把电源负极与 Arduino 的 GND 相连（共地）。

ATtiny85 只是一颗芯片，没有稳压器：VCC 要直接接 2.7–5.5 V，例如 3 节 AA 电池（4.5 V）、USB 5 V 或单节锂电池（3.0–4.2 V）。电压太低芯片不会启动（仿真显示 OFF），超过 5.5 V 可能损坏。

每颗芯片的 VCC 与 GND 之间就近放一只 100 nF 去耦电容。电机等感性负载最好使用与单片机分开的电源，至少要加大电容滤波。

*相关示例:* [单片机：ATtiny85 闪烁 LED](#ex-tinyblink) · [单片机：MOSFET 驱动直流电机调速 (PWM)](#ex-ardmotor)

### 数字输出与 LED 限流电阻

先 `pinMode(pin, OUTPUT)`，再用 `digitalWrite(pin, HIGH)` / `LOW` 输出约 5 V / 0 V。输出脚既能输出电流也能吸收电流，每脚推荐不超过 20 mA。

LED 必须串联限流电阻：R = (Vcc − Vf) / I。例如 5 V、红色 LED Vf ≈ 2 V、取 10 mA：R = (5 − 2) / 0.01 = 300 Ω，选常用值 330 Ω；用 220 Ω 约 14 mA 也可以。蓝、白色 LED 的 Vf ≈ 3 V，同样电流约需 200 Ω。

LED 长脚（阳极 +）经电阻接引脚，短脚（阴极 −）接 GND，此时 HIGH = 亮；也可以把 LED 接到 5V，由引脚吸收电流，此时 LOW = 亮。一个引脚要驱动多颗 LED 或超过 20 mA 的负载时，请用三极管或 MOSFET。

```cpp
const int LED_PIN = 8;          // 8 -> 330 ohm -> LED (+), LED (-) -> GND
void setup() {
  pinMode(LED_PIN, OUTPUT);
}
void loop() {
  digitalWrite(LED_PIN, HIGH);   // about 5 V
  delay(500);
  digitalWrite(LED_PIN, LOW);    // 0 V
  delay(500);
}
```

*相关示例:* [单片机：Arduino 闪烁 LED (Blink)](#ex-ardblink) · [单片机：Arduino 交通信号灯](#ex-ardtraffic) · [单片机：ATtiny85 闪烁 LED](#ex-tinyblink)

### 按键输入：上拉、下拉与消抖

`INPUT_PULLUP` 打开内部 20–50 kΩ 上拉电阻：按键一端接引脚、另一端接 GND，不需要外接电阻。没按时读到 HIGH，按下读到 LOW（逻辑相反）。这是最简单的接法。

下拉接法：按键接在 5V 与引脚之间，引脚再经 10 kΩ 接 GND，`pinMode(pin, INPUT)`，按下读到 HIGH。注意 `INPUT` 模式下引脚悬空时读数会随机跳动，必须有上拉或下拉电阻。

机械按键按下和松开时会抖动几毫秒，一次按压可能被读成好几次。消抖方法：读数变化后等 20–50 ms 仍不变才确认（用 `millis()` 计时，不要用长时间的 `delay()`），或在硬件上加 RC 滤波。示例「按键消抖」演示了软件消抖。

```cpp
const int BUTTON_PIN = 2;       // button between pin 2 and GND
void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
}
void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;   // LOW = pressed
  digitalWrite(LED_BUILTIN, pressed ? HIGH : LOW);
}
```

*相关示例:* [单片机：按钮控制 LED (INPUT_PULLUP)](#ex-ardbutton) · [单片机：按键消抖 切换 LED (millis)](#ex-arddebounce)

### 模拟输入：电位器、分压、光敏/热敏电阻

`analogRead(A0)` 返回 0–1023，对应 0 V 到参考电压（默认 VCC = 5 V）：电压 = 读数 × 5.0 / 1024。一次转换约 100 µs。`analogReference(INTERNAL)` 改用内部 1.1 V 参考，适合测量小电压。

电位器：两端分别接 5V 和 GND，中间抽头接 A0，旋转时读数在 0–1023 之间变化。分压电阻：Vout = Vin × R2 / (R1 + R2)，可以把高于 5 V 的电压（如 12 V 电池）降到 0–5 V 再测，但要保证输入不超过 VCC。

光敏电阻 (LDR) 和热敏电阻 (NTC) 要与一个固定电阻串联成分压器，中点接模拟口；固定电阻取传感器在中间工作点的阻值，常用 10 kΩ。LDR 接在下方时越暗电压越高；NTC 温度越高阻值越小。可以用 `map()` 把读数换算成需要的范围。

ADC 要求信号源阻抗 ≤ 10 kΩ，分压电阻太大时读数不稳，可在模拟口与 GND 之间加 100 nF 电容。A0–A5 也能当普通数字脚使用（D14–D19）。ATtiny85 的模拟口是 A1 (PB2)、A2 (PB4)、A3 (PB3)；A0 (PB5) 是复位脚，一般不用。

```cpp
void setup() {
  Serial.begin(9600);
}
void loop() {
  int raw = analogRead(A0);              // 0 ... 1023
  float volts = raw * 5.0 / 1024.0;      // default reference = 5 V
  Serial.println(volts);
  delay(200);
}
```

*相关示例:* [单片机：电位器调光 (analogRead → PWM + 串口)](#ex-ardpwm) · [单片机：光敏电阻小夜灯 (LDR → PWM)](#ex-ardnight)

### PWM：调光与调速

`analogWrite(pin, 0–255)` 在带 ~ 的引脚输出 PWM 方波：占空比 = 值 / 255，平均电压 ≈ 5 V × 值 / 255。Uno 的 D5、D6 约 980 Hz，D3、D9、D10、D11 约 490 Hz；ATtiny85 可用 PB0、PB1、PB4。

PWM 适合调 LED 亮度（人眼看到的是平均亮度）和电机转速；它不是真正的模拟电压，需要平滑电压时请加 RC 低通滤波。在不带 ~ 的引脚上调用 `analogWrite()` 时，值 < 128 输出 LOW，否则输出 HIGH。

值为 0 或 255 时输出恒定的 LOW / HIGH。人眼对亮度的感觉是非线性的，呼吸灯用平方曲线会更自然。可以用示波器观察 PWM 波形（示例「电位器调光」）。

```cpp
const int LED_PIN = 9;          // a PWM pin (~)
void setup() {
  pinMode(LED_PIN, OUTPUT);
}
void loop() {
  for (int duty = 0; duty <= 255; duty += 5) {
    analogWrite(LED_PIN, duty);   // 0 = off ... 255 = fully on
    delay(20);
  }
}
```

*相关示例:* [单片机：电位器调光 (analogRead → PWM + 串口)](#ex-ardpwm) · [单片机：ATtiny85 PWM 呼吸灯](#ex-tinyfade)

### 电机：三极管 / MOSFET 驱动与续流二极管

引脚只能提供约 20 mA，不能直接驱动电机。用 NPN 三极管或 N 沟道 MOSFET 做低边开关：负载接在电源 + 与漏极 (D) 之间，源极 (S) 接 GND，栅极 (G) 经 100–220 Ω 接 PWM 引脚，再用 10 kΩ 下拉到 GND，防止上电或复位时引脚悬空导致误启动。

请选「逻辑电平」MOSFET（如 IRLZ44N，5 V 栅压即可充分导通）；IRF540 等普通 MOSFET 的导通电阻是按 10 V 栅压标定的，5 V 下导通不充分会发热。用三极管时基极串联约 1 kΩ 电阻。

电机、继电器线圈、电磁阀都是感性负载，断开瞬间会产生很高的反向电压，必须在负载两端反向并联续流二极管（如 1N4007，阴极接电源 +）。电机电源的负极必须与 Arduino GND 相连。需要正反转时使用 H 桥驱动（如 L298N、TB6612）。

*相关示例:* [单片机：MOSFET 驱动直流电机调速 (PWM)](#ex-ardmotor)

### 继电器与大功率负载

继电器用小电流的线圈控制大电流、高电压的触点：COM 是公共端，NO 常开（线圈通电时与 COM 接通），NC 常闭。触点电路与单片机电气隔离，可以开关 12 V 灯泡或市电电器。

继电器模块内置三极管、续流二极管和指示灯，VCC/GND 接 5V/GND，IN 接任意数字脚即可。注意触发方式：很多模块是低电平触发（IN = LOW 时吸合）；仿真中的模块可在属性里选择高/低电平触发。

裸继电器的线圈电流通常在 70 mA 以上，不能直接接引脚，要用三极管驱动并加续流二极管。操作 220 V 市电非常危险，请使用带外壳的成品模块，并注意触点的额定电流。

*相关示例:* [单片机：继电器模块 定时开关 12V 灯](#ex-ardrelay)

### 蜂鸣器与 tone()

`tone(pin, 频率)` 在任意数字脚输出 50% 占空比的方波，`tone(pin, 频率, 时长)` 到时自动停止，`noTone(pin)` 停止发声。同一时间只能有一个 `tone()`；它占用 Timer2，会使 D3/D11 的 PWM 失效。

无源蜂鸣器和小喇叭需要 `tone()` 产生的方波才能发声，音调由频率决定；有源蜂鸣器内部带振荡器，只要 `digitalWrite(HIGH)` 就响，但音调固定。

蜂鸣器串联约 100 Ω 电阻限流；8 Ω 喇叭电流太大，要经三极管驱动。常用音符频率：C4 262、D4 294、E4 330、F4 349、G4 392、A4 440、B4 494、C5 523 Hz。

```cpp
const int BUZZER_PIN = 8;       // 8 -> 100 ohm -> passive buzzer -> GND
void setup() {
  tone(BUZZER_PIN, 440, 200);   // A4 for 200 ms
  delay(300);
  tone(BUZZER_PIN, 523, 200);   // C5
}
void loop() {
}
```

*相关示例:* [单片机：无源蜂鸣器播放旋律 (tone)](#ex-ardtone)

### 舵机

舵机有三根线：信号（橙/黄）、电源 +（红）、GND（棕/黑）。信号是周期约 20 ms（50 Hz）的脉冲，脉宽通常 1–2 ms 对应转角，Servo 库默认把 544–2400 µs 映射到 0–180°。用法：`attach(pin)` 之后 `write(角度)`。

Servo 库占用 Timer1，使用后 D9、D10 不能输出 PWM（舵机信号线可接任意数字脚）。Uno 最多可接 12 个舵机。

舵机启动和堵转时电流可达几百 mA 甚至 1 A 以上。SG90 这类小舵机接一个可由 5V 引脚供电；多个或大舵机请用独立的 5–6 V 电源并共地，在舵机电源端并联 100–470 µF 电容可以减少复位。

```cpp
#include <Servo.h>
Servo myServo;
void setup() {
  myServo.attach(9);            // signal wire on pin 9
}
void loop() {
  myServo.write(0);   delay(1000);
  myServo.write(90);  delay(1000);
  myServo.write(180); delay(1000);
}
```

*相关示例:* [单片机：舵机扫动 (Servo 库)](#ex-ardservo)

### LCD1602 液晶屏

LCD1602（HD44780 控制器）在 4 位模式下只需 6 根信号线：RS、E、D4–D7，RW 接 GND（只写）；也可以用 7 个参数的写法把 RW 接到引脚。`LiquidCrystal lcd(rs, en, d4, d5, d6, d7)`，然后 `lcd.begin(16, 2)`、`lcd.setCursor(列, 行)`、`lcd.print()`、`lcd.clear()`。

电源：VSS 接 GND，VDD 接 5V；V0 调对比度，通常接 10 kΩ 电位器的中间滑动端 (两端接 5V/GND)，V0 约 0.3–1 V 时最清楚。V0 太高 (例如电位器在中间，约 2.5 V) 字太淡看不见；V0 直接接 GND 字偏深但可读。A/K 是背光 LED：A 经限流电阻 (如 220 Ω) 接 5V 或接引脚控制开关，K 接 GND。

引脚不够时可以用 I²C 背板 (PCF8574)：元件“LCD1602 液晶屏 (I2C 背板)”支持 LiquidCrystal_I2C 库，SDA 接 A4、SCL 接 A5 (ATtiny85 为 PB0 / PB2)，地址 0x27 或 0x3F。I²C 只对这个元件在库函数层面模拟。行和列都从 0 开始：第二行是 `setCursor(0, 1)`。

液晶屏没有显示时依次检查：① 对比度——电位器在中间时 V0 ≈ 2.5 V，字太淡看不见，要调到 V0 ≈ 0.3–1 V；② LiquidCrystal lcd(…) 里的引脚号是否与 RS、E、D4–D7 的实际接线一致 (不一致时会提示具体哪一根接错)；③ setup() 里是否调用了 lcd.begin(16, 2)；④ VDD 是否接 5V，VSS 是否与开发板共地。

```cpp
#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);   // RS, E, D4, D5, D6, D7
void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello!");
}
void loop() {
  lcd.setCursor(0, 1);                   // column 0, row 1
  lcd.print(millis() / 1000);
  lcd.print(" s   ");
  delay(200);
}
```

*相关示例:* [单片机：LCD1602 显示计数 (LiquidCrystal)](#ex-ardlcd) · [单片机：I2C 液晶屏 (LCD1602 + PCF8574)](#ex-snlcdi2c)

### 串口调试

`Serial.begin(9600)` 打开串口（波特率要与串口监视器一致），`Serial.print()` / `println()` 输出文字和数值。这是调试程序最常用的方法：打印变量、程序走到了哪里、传感器读数。

`Serial.available()` 返回已收到的字节数，`Serial.read()` 读一个字节，`Serial.readStringUntil('\n')` 读一行。仿真中在串口监视器的输入框里发送文字。

Uno 的串口占用 D0/D1，使用串口时不要在这两个脚上接其他电路。打印太频繁会拖慢程序（9600 波特约每毫秒 1 个字符），可以用 `millis()` 控制打印间隔。ATtiny85 没有硬件串口，仿真中的 `Serial` 仅用于调试。

```cpp
void setup() {
  Serial.begin(9600);
  Serial.println("ready");
}
void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    Serial.print("got: ");
    Serial.println(line);
  }
}
```

*相关示例:* [单片机：电位器调光 (analogRead → PWM + 串口)](#ex-ardpwm) · [单片机：按键消抖 切换 LED (millis)](#ex-arddebounce) · [单片机：Arduino 交通信号灯](#ex-ardtraffic)

### millis() 非阻塞定时

`delay()` 期间程序什么也做不了（不能读按键，也不能刷新别的 LED）。`millis()` 返回上电以来的毫秒数，用「当前时间 − 上次时间 ≥ 间隔」判断是否到时，就能同时处理多件事。

时间变量要用 `unsigned long`。用减法比较 `millis() - last >= INTERVAL`，约 49.7 天后计数回绕时也正确；不要写成 `millis() >= last + INTERVAL`。

每个任务一个时间变量，就组成了简单的状态机：示例「millis() 多任务」让两颗 LED 以不同节奏闪烁并同时打印运行时间，「按键消抖」也用同样的方法。需要微秒精度时用 `micros()`。

```cpp
unsigned long last = 0;
const unsigned long INTERVAL = 500;
bool on = false;
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}
void loop() {
  if (millis() - last >= INTERVAL) {
    last += INTERVAL;
    on = !on;
    digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
  }
  // ...other work here keeps running
}
```

*相关示例:* [单片机：millis() 多任务 (不用 delay)](#ex-ardmulti) · [单片机：按键消抖 切换 LED (millis)](#ex-arddebounce)

<a id="sensors"></a>

## 传感器

传感器元件都在元件库的“传感器”分类里。下表列出每个元件的引脚和程序读取方式；被测量可以在属性面板里直接设置 (滑块 + 数值)，也可以选一个随仿真时间变化的信号源。

| 元件 | 引脚 | 程序读取方式 |
|---|---|---|
| **光敏电阻模块** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **MQ 气体传感器模块** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **火焰传感器模块** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **土壤湿度传感器** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **雨滴传感器** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **热敏电阻模块** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **声音传感器 (包络输出)** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **TCRT5000 循迹模块** | VCC · GND · DO · AO | AO → `analogRead()`；DO (LM393 比较器，阈值由板上电位器设定) → `digitalRead()` |
| **水位传感器** | S · + · − | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **LM35 温度传感器** | +Vs · Vout · GND | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **TMP36 温度传感器** | +Vs · Vout · GND | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **弯曲传感器** | 1 · 2 | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **薄膜压力传感器 (FSR)** | 1 · 2 | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **双轴摇杆模块** | GND · +5V · VRx · VRy · SW | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **ACS712 电流传感器** | VCC · OUT · GND · IP+ · IP− | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **压力传感器 (模拟输出)** | +5V · GND · OUT | 输出电压 → `analogRead()` (0–1023 对应 0–5 V) |
| **HC-SR501 人体红外传感器** | VCC · OUT · GND | 数字输出 → `digitalRead()` (有效电平见元件说明) |
| **红外避障模块** | OUT · GND · VCC | 数字输出 → `digitalRead()` (有效电平见元件说明) |
| **倾斜开关 (SW-520D)** | 1 · 2 | 数字输出 → `digitalRead()` (有效电平见元件说明) |
| **SW-420 振动传感器模块** | VCC · GND · DO | 数字输出 → `digitalRead()` (有效电平见元件说明) |
| **TTP223 触摸模块** | VCC · I/O · GND | 数字输出 → `digitalRead()` (有效电平见元件说明) |
| **KY-040 旋转编码器** | GND · + · SW · DT · CLK | CLK / DT → `digitalRead()` 判断方向，SW → `INPUT_PULLUP` |
| **HC-SR04 超声波测距** | VCC · Trig · Echo · GND | Trig 输出 ≥ 10 µs 高电平，`pulseIn(echo, HIGH)` 测 Echo 脉宽；距离 (cm) ≈ 脉宽 (µs) / 58 |
| **DHT11 / DHT22 温湿度传感器** | VCC · DATA · GND | `#include <DHT.h>`：`DHT dht(pin, DHT22); dht.begin();` 然后 `dht.readTemperature()` / `dht.readHumidity()` |
| **DS18B20 数字温度传感器** | GND · DQ · VDD | `OneWire` + `DallasTemperature`：`sensors.begin(); sensors.requestTemperatures(); sensors.getTempCByIndex(0);` (DQ 需 4.7 kΩ 上拉) |
| **LCD1602 液晶屏 (I2C 背板)** | GND · VCC · SDA · SCL | `LiquidCrystal_I2C lcd(0x27, 16, 2); lcd.init(); lcd.backlight();`，SDA → A4，SCL → A5 |

- 带 DO 的模块用 LM393 比较器把 AO 与阈值比较，板上指示灯随 DO 变化。不同模块的有效电平不同 (例如光敏、火焰、土壤模块是低电平有效，声音和 SW-420 模块是高电平有效)，具体见每个元件的说明。
- 信号源：每个传感器的主要被测量都可以选择正弦、三角波、方波或斜坡，并设置最小值、最大值和周期，仿真运行时自动变化，不用手动拖动滑块就能测试程序。
- 模拟量换算：电压 = 读数 × 5 / 1023。LM35 每 °C 输出 10 mV，配合 `analogReference(INTERNAL)` (1.1 V) 分辨率约 0.1 °C；ACS712 在零电流时输出 VCC/2。
- DHT、DS18B20 和 I2C 液晶屏在库函数层面模拟：数据线必须接到程序里写的引脚，并且供电、共地正确，否则读数为 NaN / −127 或液晶屏没有显示，原因会显示在提示和开发板的读数里。

<a id="ex-snsultra"></a>

### 传感器：超声波测距 → LCD1602

HC-SR04 大约每 100 ms 测一次距离 (`pulseIn` 测 Echo 脉宽)，距离显示在 LCD1602 上，Echo 脉宽 (µs) 输出到串口。目标距离由正弦信号源在 15–250 cm 之间变化；V0 经 100 kΩ 接 5V，与屏内下拉形成约 0.9 V 的对比度电压。

**接线**

- HC-SR04 超声波测距: VCC → 5V, GND → GND, Trig → D7, Echo → D6
- LCD1602 液晶屏: RS → D3, RW → D4, E → D5, D4…D7 → D9…D12, A → D13, K / VSS → GND, VDD → 5V, V0 → 100 kΩ → VDD

```cpp
// Ultrasonic distance meter: HC-SR04 (Trig = D7, Echo = D6) shown on an LCD1602.
// Echo pulse width in microseconds / 58 = distance in cm (sound: about 0.0343 cm/us, there and back).
#include <LiquidCrystal.h>

LiquidCrystal lcd(3, 4, 5, 9, 10, 11, 12);   // RS, RW, E, D4..D7
const int TRIG = 7;
const int ECHO = 6;

void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);        // backlight
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  lcd.begin(16, 2);
  lcd.print("HC-SR04 distance");
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);      // trigger pulse of 10 us
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 30000);   // 0 = no echo within 30 ms
  lcd.setCursor(0, 1);
  if (us == 0) {
    lcd.print("out of range    ");
  } else {
    float cm = us / 58.0;
    lcd.print(cm, 1);
    lcd.print(" cm          ");
  }
  Serial.println(us);
  delay(100);
}
```

<a id="ex-sndht"></a>

### 传感器：DHT22 温湿度 → 串口监视器

用 DHT 库每 2 秒读取一次 DHT22 的温度、湿度并计算体感温度，输出到串口监视器。温度由正弦信号源在 18–32 °C 之间变化。

**接线**

- DHT11 / DHT22 温湿度传感器: VCC → 5V, DATA → D2, GND → GND

```cpp
// DHT22 temperature and humidity -> serial monitor every 2 s (DHT library).
#include <DHT.h>

DHT dht(2, DHT22);            // DATA on pin 2

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  delay(2000);                // the sensor needs 2 s between readings
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT read failed - check the wiring");
    return;
  }
  Serial.print("T = ");
  Serial.print(t, 1);
  Serial.print(" C   RH = ");
  Serial.print(h, 1);
  Serial.print(" %   heat index = ");
  Serial.print(dht.computeHeatIndex(t, h, false), 1);
  Serial.println(" C");
}
```

<a id="ex-snpir"></a>

### 传感器：人体感应小夜灯 (PIR + 光敏)

HC-SR501 检测到有人移动、并且光敏模块判断为天黑时，点亮 D9 上的 LED 10 秒。PIR 的“有人移动”由方波信号源模拟，也可以单击 PIR 元件。

**接线**

- HC-SR501 人体红外传感器: VCC → 5V, OUT → D2, GND → GND
- 光敏电阻模块: AO → A0, VCC → 5V, GND → GND
- D9 → 220 Ω → LED → GND

```cpp
// PIR night light: the LED on pin 9 stays on for 10 s after motion, but only when it is dark.
const int PIR = 2;
const int LED = 9;
const int DARK = 600;          // AO of the light-sensor module rises in the dark
unsigned long onUntil = 0;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(A0);
  if (digitalRead(PIR) == HIGH && light > DARK) {
    if (millis() >= onUntil) Serial.println("motion in the dark: light on");
    onUntil = millis() + 10000;
  }
  digitalWrite(LED, millis() < onUntil ? HIGH : LOW);
  delay(20);
}
```

<a id="ex-snsoil"></a>

### 传感器：土壤湿度报警 (蜂鸣器)

土壤湿度传感器 AO 接 A0：土壤太干 (读数高) 时 D8 上的有源蜂鸣器报警。湿度由三角波信号源在 10–90 % 之间变化。

**接线**

- 土壤湿度传感器: AO → A0, VCC → 5V, GND → GND
- 有源蜂鸣器: + → D8, − → GND

```cpp
// Soil moisture alarm: beeps while the soil is too dry (AO is high when the soil is dry).
const int BUZZER = 8;
const int DRY = 700;

void setup() {
  pinMode(BUZZER, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int v = analogRead(A0);
  Serial.print("soil AO = ");
  Serial.println(v);
  if (v > DRY) {
    digitalWrite(BUZZER, HIGH);
    delay(200);
    digitalWrite(BUZZER, LOW);
    delay(300);
  } else {
    digitalWrite(BUZZER, LOW);
    delay(500);
  }
}
```

<a id="ex-sngas"></a>

### 传感器：气体浓度报警 (MQ-2 + 继电器)

MQ-2 的 AO 超过设定值或 DO 变低时，D8 的继电器 (例如接风扇) 和 D9 的红色 LED 打开。气体浓度由正弦信号源在 0–3000 ppm 之间变化。

**接线**

- MQ 气体传感器模块: AO → A0, DO → D7, VCC → 5V, GND → GND
- 继电器模块 (1 路): IN → D8, VCC → 5V, GND → GND
- D9 → 220 Ω → LED → GND

```cpp
// Gas alarm with an MQ-2 module: AO -> A0 (rises with gas), DO -> 7 (LOW above the module threshold).
// Above the limit the relay on pin 8 (e.g. a fan) and the red LED on pin 9 switch on.
const int RELAY = 8;
const int LED = 9;
const int DO_PIN = 7;
const int LIMIT = 400;

void setup() {
  pinMode(RELAY, OUTPUT);
  pinMode(LED, OUTPUT);
  pinMode(DO_PIN, INPUT);
  Serial.begin(9600);
}

void loop() {
  int gas = analogRead(A0);
  bool alarm = gas > LIMIT || digitalRead(DO_PIN) == LOW;
  digitalWrite(RELAY, alarm ? HIGH : LOW);
  digitalWrite(LED, alarm ? HIGH : LOW);
  Serial.print("gas AO = ");
  Serial.print(gas);
  Serial.println(alarm ? "  ALARM" : "");
  delay(250);
}
```

<a id="ex-snlm35"></a>

### 传感器：LM35 温度计

LM35 接 A0，用 1.1 V 内部参考电压读取，分辨率约 0.1 °C，结果输出到串口。温度由三角波信号源在 15–45 °C 之间变化。

**接线**

- LM35 温度传感器: +Vs → 5V, Vout → A0, GND → GND

```cpp
// LM35 thermometer: 10 mV per degree C on A0, read with the 1.1 V internal reference
// (about 0.1 C per step, up to 110 C).
void setup() {
  analogReference(INTERNAL);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float c = raw * 110.0 / 1024.0;
  Serial.print("LM35: ");
  Serial.print(c, 1);
  Serial.println(" C");
  delay(500);
}
```

<a id="ex-snline"></a>

### 传感器：双路循迹 (TCRT5000)

两个 TCRT5000 循迹模块的 DO 接 D2 / D3，程序按“左偏 / 右偏 / 直行 / 停止”逻辑控制 D9、D11 上的两个 LED (代表左右电机)。黑线位置由方波信号源模拟。

**接线**

- TCRT5000 循迹模块 (L): DO → D2, VCC → 5V, GND → GND
- TCRT5000 循迹模块 (R): DO → D3, VCC → 5V, GND → GND
- D9 / D11 → 220 Ω → LED → GND

```cpp
// Line follower logic with two TCRT5000 modules: DO is HIGH over the black line.
// The LEDs on 9 (left motor) and 11 (right motor) show what a robot would do.
const int L_SENS = 2;
const int R_SENS = 3;
const int L_MOTOR = 9;
const int R_MOTOR = 11;

void setup() {
  pinMode(L_SENS, INPUT);
  pinMode(R_SENS, INPUT);
  pinMode(L_MOTOR, OUTPUT);
  pinMode(R_MOTOR, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool l = digitalRead(L_SENS) == HIGH;   // true = this sensor sees the line
  bool r = digitalRead(R_SENS) == HIGH;
  if (l && !r) {            // line on the left: slow the left wheel
    digitalWrite(L_MOTOR, LOW);
    digitalWrite(R_MOTOR, HIGH);
    Serial.println("turn left");
  } else if (r && !l) {
    digitalWrite(L_MOTOR, HIGH);
    digitalWrite(R_MOTOR, LOW);
    Serial.println("turn right");
  } else if (l && r) {      // both on the line: crossing / end mark
    digitalWrite(L_MOTOR, LOW);
    digitalWrite(R_MOTOR, LOW);
    Serial.println("stop");
  } else {
    digitalWrite(L_MOTOR, HIGH);
    digitalWrite(R_MOTOR, HIGH);
    Serial.println("straight");
  }
  delay(200);
}
```

<a id="ex-snenc"></a>

### 传感器：旋转编码器计数

KY-040 旋转编码器 CLK → D2、DT → D3、SW → D4：程序检测 CLK 的变化判断方向并计数，按下旋钮清零。属性里的“自动旋转速度”让它自己转动。

**接线**

- KY-040 旋转编码器: CLK → D2, DT → D3, SW → D4, + → 5V, GND → GND

```cpp
// KY-040 rotary encoder: count the detents (CLK = 2, DT = 3); the push button on 4 resets the count.
const int CLK = 2;
const int DT = 3;
const int SW = 4;
int count = 0;
int lastClk;

void setup() {
  pinMode(CLK, INPUT);
  pinMode(DT, INPUT);
  pinMode(SW, INPUT_PULLUP);     // the module has no pull-up on SW
  Serial.begin(9600);
  lastClk = digitalRead(CLK);
}

void loop() {
  int clk = digitalRead(CLK);
  if (clk != lastClk && clk == LOW) {   // one detent = one falling edge on CLK
    if (digitalRead(DT) != clk) count++;  // DT still HIGH: clockwise
    else count--;
    Serial.print("count = ");
    Serial.println(count);
  }
  lastClk = clk;
  if (digitalRead(SW) == LOW) {
    count = 0;
    Serial.println("reset");
    delay(300);
  }
  delay(1);
}
```

<a id="ex-snacs"></a>

### 传感器：ACS712 电流监测

ACS712-5A 串在 12 V 电池和 24 W 灯泡之间，OUT 接 A0；程序取 50 次平均，按 2.5 V + 0.185 V/A × I 换算电流 (约 2 A) 输出到串口。

**接线**

- ACS712 电流传感器: VCC → 5V, OUT → A0, GND → GND
- 电池 12 V + → IP+, IP− → 灯泡 → 电池 −

```cpp
// ACS712-5A current monitor: OUT = 2.5 V + 0.185 V/A x I (5 V supply). Averages 50 readings.
const float SENSITIVITY = 0.185;   // V per A (5 A version)
const float ZERO = 2.5;            // output at 0 A

void setup() {
  Serial.begin(9600);
}

void loop() {
  long sum = 0;
  for (int i = 0; i < 50; i++) sum += analogRead(A0);
  float v = sum / 50.0 * 5.0 / 1024.0;
  float amps = (v - ZERO) / SENSITIVITY;
  Serial.print("I = ");
  Serial.print(amps, 2);
  Serial.println(" A");
  delay(500);
}
```

<a id="ex-snds18"></a>

### 传感器：DS18B20 数字温度计

DS18B20 的 DQ 接 D4，并用 4.7 kΩ 电阻上拉到 5V；用 OneWire + DallasTemperature 库读取温度，输出到串口。温度由正弦信号源在 18–30 °C 之间变化。

**接线**

- DS18B20 数字温度传感器: GND → GND, DQ → D4, VDD → 5V
- 4.7 kΩ 电阻: DQ → VDD

```cpp
// DS18B20 on pin 4 (4.7 kOhm pull-up to 5 V) with the OneWire + DallasTemperature libraries.
#include <OneWire.h>
#include <DallasTemperature.h>

OneWire oneWire(4);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(9600);
  sensors.begin();
  Serial.print("devices: ");
  Serial.println(sensors.getDeviceCount());
}

void loop() {
  sensors.requestTemperatures();          // 12 bit: waits 750 ms for the conversion
  float c = sensors.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) {
    Serial.println("sensor not found");
  } else {
    Serial.print("T = ");
    Serial.print(c, 2);
    Serial.println(" C");
  }
  delay(250);
}
```

<a id="ex-snlcdi2c"></a>

### 单片机：I2C 液晶屏 (LCD1602 + PCF8574)

带 PCF8574 背板的 LCD1602 只需 4 根线：GND、VCC (5V)、SDA → A4、SCL → A5，地址 0x27。用 LiquidCrystal_I2C 库显示 TMP36 测得的温度和运行时间。

**接线**

- LCD1602 液晶屏 (I2C 背板): GND → GND, VCC → 5V, SDA → A4, SCL → A5
- TMP36 温度传感器: +Vs → 5V, Vout → A0, GND → GND

```cpp
// LCD1602 with an I2C backpack (PCF8574, address 0x27): only 4 wires - GND, VCC, SDA = A4, SCL = A5.
// Shows the TMP36 temperature (A0) and the uptime.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Wire.beginTransmission(0x27);           // is anything answering at 0x27?
  if (Wire.endTransmission() != 0) Serial.println("no I2C device at 0x27");
  lcd.init();
  lcd.backlight();
  lcd.print("TMP36 + I2C LCD");
}

void loop() {
  float v = analogRead(A0) * 5.0 / 1024.0;
  float c = (v - 0.5) * 100.0;           // TMP36: 0.5 V at 0 C, 10 mV per C
  lcd.setCursor(0, 1);
  lcd.print(c, 1);
  lcd.print((char)223);                  // degree sign
  lcd.print("C  ");
  lcd.print(millis() / 1000);
  lcd.print(" s    ");
  delay(500);
}
```

<a id="examples"></a>

## 示例

「载入到画布」会替换当前电路并开始仿真；「插入编辑器」把代码放进当前芯片的程序编辑器（尚未上传，可修改后再上传）；「复制代码」复制到剪贴板。

### Arduino Uno 开发板

<a id="ex-ardblink"></a>

#### 单片机：Arduino 闪烁 LED (Blink)

板载 LED (D13) 与 D8 上的外接 LED 每 0.5 秒交替闪烁；双击开发板可查看和修改程序。

**接线**

- D8 → 220 Ω 电阻 → 绿色 LED 阳极（+，长脚）
- 绿色 LED 阴极（−） → GND
- D13 → 板载 LED（L）

**相关用法:** 数字输出与 LED 限流电阻

```cpp
// Blink: the on-board LED (pin 13) and an external LED on pin 8 blink alternately.
const int LED_EXT = 8;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(LED_EXT, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink started");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  digitalWrite(LED_EXT, LOW);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  digitalWrite(LED_EXT, HIGH);
  delay(500);
}
```

<a id="ex-ardtraffic"></a>

#### 单片机：Arduino 交通信号灯

红、红+黄、绿、黄四个相位循环，当前相位同时输出到串口监视器。

**接线**

- D10 → 220 Ω → 红色 LED
- D9 → 220 Ω → 黄色 LED
- D8 → 220 Ω → 绿色 LED
- 所有 LED 的阴极 → GND

**相关用法:** 数字输出与 LED 限流电阻 · 串口调试

```cpp
// Traffic light: red, red + yellow, green, yellow (pins 10, 9, 8).
const int RED_PIN = 10;
const int YELLOW_PIN = 9;
const int GREEN_PIN = 8;

void setLights(bool r, bool y, bool g) {
  digitalWrite(RED_PIN, r ? HIGH : LOW);
  digitalWrite(YELLOW_PIN, y ? HIGH : LOW);
  digitalWrite(GREEN_PIN, g ? HIGH : LOW);
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  Serial.println("RED");
  setLights(true, false, false);
  delay(3000);
  Serial.println("RED + YELLOW");
  setLights(true, true, false);
  delay(1000);
  Serial.println("GREEN");
  setLights(false, false, true);
  delay(3000);
  Serial.println("YELLOW");
  setLights(false, true, false);
  delay(1000);
}
```

<a id="ex-ardbutton"></a>

#### 单片机：按钮控制 LED (INPUT_PULLUP)

按钮接在 D2 与 GND 之间，使用内部上拉 (INPUT_PULLUP)；按住按钮时 D7 上的 LED 点亮。

**接线**

- D2 → 按钮 → GND (使用内部上拉)
- D7 → 220 Ω → 红色 LED → GND

**相关用法:** 按键输入：上拉、下拉与消抖 · 串口调试

```cpp
// Button with INPUT_PULLUP: pressing the button (pin 2 to GND) lights the LED on pin 7.
const int BUTTON_PIN = 2;
const int LED_PIN = 7;
int lastState = HIGH;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int state = digitalRead(BUTTON_PIN);   // LOW while pressed
  digitalWrite(LED_PIN, state == LOW ? HIGH : LOW);
  if (state != lastState) {
    Serial.println(state == LOW ? "pressed" : "released");
    lastState = state;
  }
  delay(10);
}
```

<a id="ex-arddebounce"></a>

#### 单片机：按键消抖 切换 LED (millis)

每按一次 D2 上的按键就切换 D8 上 LED 的亮灭：输入保持 30 ms 不变才确认，避免抖动造成多次切换；串口打印按键次数。

**接线**

- D2 → 按钮 → GND (使用内部上拉)
- D8 → 220 Ω → 红色 LED → GND

**相关用法:** 按键输入：上拉、下拉与消抖 · millis() 非阻塞定时 · 串口调试

```cpp
// Debounced button: each press of the button on D2 (INPUT_PULLUP, to GND) toggles the LED on D8.
// A change is accepted only after the input has been stable for 30 ms.
const int BUTTON_PIN = 2;
const int LED_PIN = 8;
const unsigned long DEBOUNCE_MS = 30;

int stableState = HIGH;       // debounced state (HIGH = released)
int lastReading = HIGH;
unsigned long lastChange = 0;
bool ledOn = false;
int presses = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Press the button");
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) {          // the input moved: restart the timer
    lastReading = reading;
    lastChange = millis();
  }
  if (millis() - lastChange >= DEBOUNCE_MS && reading != stableState) {
    stableState = reading;
    if (stableState == LOW) {            // a new, clean press
      ledOn = !ledOn;
      digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
      presses++;
      Serial.print("presses: ");
      Serial.println(presses);
    }
  }
}
```

<a id="ex-ardpwm"></a>

#### 单片机：电位器调光 (analogRead → PWM + 串口)

A0 读取电位器电压 (0–1023)，映射为 D9 的 PWM 占空比来调节 LED 亮度；示波器显示 PWM 波形，串口打印数值。

**接线**

- 电位器: 两端 → 5V / GND, 中间抽头 → A0
- D9 ~ → 220 Ω → 红色 LED → GND
- 示波器 CH1 → D9, GND → GND

**相关用法:** 模拟输入：电位器、分压、光敏/热敏电阻 · PWM：调光与调速 · 串口调试

```cpp
// Potentiometer on A0 sets the brightness of the LED on pin 9 (PWM, about 490 Hz).
// The values are printed to the serial monitor; pin 9 is shown on the oscilloscope.
const int POT_PIN = A0;
const int LED_PIN = 9;
unsigned long lastPrint = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("pot -> PWM");
}

void loop() {
  int raw = analogRead(POT_PIN);           // 0..1023
  int duty = map(raw, 0, 1023, 0, 255);     // 0..255
  analogWrite(LED_PIN, duty);
  if (millis() - lastPrint >= 250) {
    lastPrint = millis();
    float volts = raw * 5.0 / 1023.0;
    Serial.print("A0 = ");
    Serial.print(raw);
    Serial.print("  (");
    Serial.print(volts);
    Serial.print(" V)  PWM = ");
    Serial.println(duty);
  }
  delay(20);
}
```

<a id="ex-ardnight"></a>

#### 单片机：光敏电阻小夜灯 (LDR → PWM)

5V → 10 kΩ → A0 → 光敏电阻 → GND 组成分压器：越暗读数越高，D9 的 PWM 让白色 LED 越亮。在属性中调节光敏电阻的「光照强度」试试。

**接线**

- 5V → 10 kΩ 电阻 → A0
- A0 → 光敏电阻 → GND
- D9 ~ → 220 Ω → 白色 LED → GND

**相关用法:** 模拟输入：电位器、分压、光敏/热敏电阻 · PWM：调光与调速

```cpp
// LDR night light: 5V -> 10k -> A0 -> LDR -> GND.
// Less light = higher LDR resistance = higher reading = brighter LED on D9 (PWM).
const int LDR_PIN = A0;
const int LED_PIN = 9;
unsigned long lastPrint = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(LDR_PIN);               // bright: low, dark: high
  int level = constrain(raw, 300, 900);
  int duty = map(level, 300, 900, 0, 255);     // off in daylight, full in the dark
  analogWrite(LED_PIN, duty);
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();
    Serial.print("light reading = ");
    Serial.print(raw);
    Serial.print("  LED PWM = ");
    Serial.println(duty);
  }
  delay(20);
}
```

<a id="ex-ardmulti"></a>

#### 单片机：millis() 多任务 (不用 delay)

完全不用 delay()：D8 的 LED 每 250 ms 翻转，D7 的 LED 每 700 ms 翻转，每秒打印一次运行时间，三件事同时进行。

**接线**

- D8 → 220 Ω → 红色 LED → GND
- D7 → 220 Ω → 绿色 LED → GND

**相关用法:** millis() 非阻塞定时 · 数字输出与 LED 限流电阻

```cpp
// Non-blocking multitasking with millis(): there is no delay() anywhere,
// so all three tasks run "at the same time".
// Task 1: LED on D8 toggles every 250 ms. Task 2: LED on D7 toggles every 700 ms.
// Task 3: print the uptime once per second.
const int LED_A = 8;
const int LED_B = 7;
unsigned long lastA = 0, lastB = 0, lastPrint = 0;
bool stateA = false, stateB = false;

void setup() {
  pinMode(LED_A, OUTPUT);
  pinMode(LED_B, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  unsigned long now = millis();
  if (now - lastA >= 250) {        // unsigned subtraction also works when millis() wraps
    lastA += 250;
    stateA = !stateA;
    digitalWrite(LED_A, stateA ? HIGH : LOW);
  }
  if (now - lastB >= 700) {
    lastB += 700;
    stateB = !stateB;
    digitalWrite(LED_B, stateB ? HIGH : LOW);
  }
  if (now - lastPrint >= 1000) {
    lastPrint += 1000;
    Serial.print("uptime: ");
    Serial.print(now / 1000);
    Serial.println(" s");
  }
}
```

<a id="ex-ardmotor"></a>

#### 单片机：MOSFET 驱动直流电机调速 (PWM)

电位器 → A0 → D9 的 PWM → 逻辑电平 MOSFET IRLZ44N → 直流电机。电机用独立的 6 V 电池并与 Arduino 共地，1N4007 续流二极管吸收关断时的反向电压。

**接线**

- 电位器: 两端 → 5V / GND, 中间抽头 → A0
- D9 ~ → 220 Ω → N 沟道 MOS 管 IRLZ44N 栅极 G
- 栅极 G → 10 kΩ → GND
- 电池 6 V + → 直流电机 +, 直流电机 − → 漏极 D
- 二极管 1N4007: 与电机反向并联（阴极接电源 +）作续流
- 源极 S → GND, 电池 − → GND (共地)

**相关用法:** 电机：三极管 / MOSFET 驱动与续流二极管 · PWM：调光与调速 · 模拟输入：电位器、分压、光敏/热敏电阻

```cpp
// Motor speed control: potentiometer on A0 -> PWM on D9 -> logic-level MOSFET (IRLZ44N) -> DC motor.
// The motor has its own 6 V battery and the grounds are joined. 220 ohm in series with the gate,
// 10k from gate to GND keeps the MOSFET off while the pin floats (reset, upload).
// The 1N4007 across the motor (cathode to +6 V) absorbs the spike when the MOSFET turns off.
const int POT_PIN = A0;
const int GATE_PIN = 9;
unsigned long lastPrint = 0;

void setup() {
  pinMode(GATE_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(POT_PIN);
  int duty = map(raw, 0, 1023, 0, 255);
  analogWrite(GATE_PIN, duty);
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();
    Serial.print("speed = ");
    Serial.print(duty * 100L / 255);
    Serial.println(" %");
  }
  delay(20);
}
```

<a id="ex-ardrelay"></a>

#### 单片机：继电器模块 定时开关 12V 灯

D7 控制继电器模块（高电平触发），让 12 V 灯泡亮 2 秒、灭 2 秒。灯泡回路与 Arduino 电气隔离，引脚只需提供几 mA。

**接线**

- 继电器模块 (1 路) VCC → 5V, GND → GND, IN → D7
- 电池 12 V + → COM
- NO → 灯泡 12 V → 电池 −

**相关用法:** 继电器与大功率负载

```cpp
// Relay timer: a relay module on D7 switches a 12 V lamp on for 2 s and off for 2 s.
// The module (high-level trigger) has its own transistor and flyback diode, so the pin
// only supplies a few mA. The lamp circuit is isolated from the Arduino.
const int RELAY_PIN = 7;

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);     // start with the relay released
  Serial.begin(9600);
}

void loop() {
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("relay ON");
  delay(2000);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("relay OFF");
  delay(2000);
}
```

<a id="ex-ardtone"></a>

#### 单片机：无源蜂鸣器播放旋律 (tone)

D8 经 100 Ω 驱动无源蜂鸣器，用 tone() 播放一段 16 拍的旋律（0 表示休止），串口打印每个音符的频率。

**接线**

- D8 → 100 Ω → 无源蜂鸣器 +
- 无源蜂鸣器 − → GND

**相关用法:** 蜂鸣器与 tone()

```cpp
// Melody on a passive buzzer: D8 -> 100 ohm -> buzzer (+), buzzer (-) -> GND.
// tone(pin, frequency, duration) makes a square wave without blocking; 0 = rest.
const int BUZZER_PIN = 8;
const int NOTES = 16;
const int melody[NOTES] = {262, 262, 392, 392, 440, 440, 392, 0,
                           349, 349, 330, 330, 294, 294, 262, 0};
int noteIndex = 0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int f = melody[noteIndex];
  if (f > 0) {
    tone(BUZZER_PIN, f, 250);
    Serial.print("note ");
    Serial.print(f);
    Serial.println(" Hz");
  }
  delay(300);
  noteIndex = (noteIndex + 1) % NOTES;
}
```

<a id="ex-ardservo"></a>

#### 单片机：舵机扫动 (Servo 库)

Servo 库在 D9 输出 50 Hz 脉冲 (1–2 ms)，舵机在 0° 与 180° 之间来回扫动。

**接线**

- 舵机 SG90 信号线 → D9
- 舵机 SG90 电源线 → 5V
- 舵机 SG90 地线 → GND

**相关用法:** 舵机

```cpp
// Servo sweep: the servo on pin 9 moves from 0 to 180 degrees and back.
#include <Servo.h>

Servo myServo;
int angle = 0;
int step = 5;

void setup() {
  myServo.attach(9, 1000, 2000);   // pulse width 1.0 ms = 0 deg ... 2.0 ms = 180 deg
  Serial.begin(9600);
}

void loop() {
  myServo.write(angle);
  if (angle % 45 == 0) {
    Serial.print("angle = ");
    Serial.println(angle);
  }
  angle += step;
  if (angle <= 0 || angle >= 180) step = -step;
  delay(50);
}
```

<a id="ex-ardlcd"></a>

#### 单片机：LCD1602 显示计数 (LiquidCrystal)

LiquidCrystal 库以 4 位模式驱动 LCD1602：第一行显示问候语，第二行每 0.5 秒刷新计数。

**接线**

- LCD RS → D3, RW → D4, E → D5
- LCD D4 / D5 / D6 / D7 → D9 / D10 / D11 / D12
- LCD A (背光) → D13, K → GND
- LCD VSS → GND, VDD → 5V
- LCD V0 (对比度) → 100 kΩ → VDD

**相关用法:** LCD1602 液晶屏

```cpp
// LCD1602 with the LiquidCrystal library (4-bit mode): RS=3, RW=4, E=5, D4..D7 = 9..12.
// Pin 13 switches the backlight on; the second line shows a counter.
#include <LiquidCrystal.h>

LiquidCrystal lcd(3, 4, 5, 9, 10, 11, 12);
int counter = 0;

void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);      // backlight
  lcd.begin(16, 2);
  lcd.print("Hello, Arduino!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("count: ");
  lcd.print(counter);
  counter++;
  delay(500);
}
```

### ATtiny85 单片机 (8 脚)

<a id="ex-tinyblink"></a>

#### 单片机：ATtiny85 闪烁 LED

ATtiny85 需要真实的 VCC/GND 供电 (5 V 电池)，PB0 上的 LED 亮 250 ms、灭 750 ms。

**接线**

- PB0 (第 5 脚) → 330 Ω → 黄色 LED → GND
- VCC (第 8 脚) → 电池 5 V +
- GND (第 4 脚) → 电池 −

**相关用法:** 数字输出与 LED 限流电阻 · 供电方式

```cpp
// ATtiny85 blink: LED on PB0 (pin 5), 250 ms on / 750 ms off.
#define LED_PIN PB0

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(250);
  digitalWrite(LED_PIN, LOW);
  delay(750);
}
```

<a id="ex-tinyfade"></a>

#### 单片机：ATtiny85 PWM 呼吸灯

ATtiny85 在 PB0（第 5 脚）和 PB1（第 6 脚）输出 PWM：黄色 LED 渐亮时绿色 LED 渐暗，循环往复。

**接线**

- PB0 (第 5 脚) → 330 Ω → 黄色 LED → GND
- PB1 (第 6 脚) → 330 Ω → 绿色 LED → GND
- VCC (第 8 脚) → 电池 5 V +
- GND (第 4 脚) → 电池 −

**相关用法:** PWM：调光与调速 · 供电方式

```cpp
// ATtiny85 PWM fade: the LED on PB0 (pin 5) fades in and out, the LED on PB1 (pin 6)
// does the opposite. The ATtiny85 has PWM on PB0, PB1 and PB4.
#define LED_A PB0
#define LED_B PB1

int level = 0;
int step = 5;

void setup() {
  pinMode(LED_A, OUTPUT);
  pinMode(LED_B, OUTPUT);
}

void loop() {
  analogWrite(LED_A, level);
  analogWrite(LED_B, 255 - level);
  level += step;
  if (level <= 0 || level >= 255) step = -step;
  delay(20);
}
```

