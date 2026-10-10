#!/usr/bin/env python3
# Generates js/i18n-v14/<lang>.js (audio / speaker / power-amplifier keys) — zh-CN is the source, zh-TW via opencc.
import json, os, sys
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'i18n-v14')
L = ['en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-BR']
R = []   # (key, zh, en, ja, ko, es, fr, de, ru, pt)
def r(k, zh, *v):
    assert len(v) == 8, (k, len(v))
    R.append((k, zh) + v)
# ---- UI strings
r('h.sound_title', '声音开关 (默认静音；点击后开启喇叭发声)', 'Sound on/off (muted by default; click to let speakers play)', 'サウンド オン/オフ (既定はミュート。クリックでスピーカーが鳴ります)', '소리 켜기/끄기 (기본값 음소거, 클릭하면 스피커가 소리를 냅니다)', 'Sonido on/off (silenciado por defecto; clic para oír los altavoces)', 'Son on/off (muet par défaut ; cliquez pour activer les haut-parleurs)', 'Ton an/aus (standardmäßig stumm; Klick aktiviert die Lautsprecher)', 'Звук вкл/выкл (по умолчанию выключен; нажмите, чтобы динамики заиграли)', 'Som ligado/desligado (mudo por padrão; clique para ouvir os alto-falantes)')
r('h.volume_title', '音量', 'Volume', '音量', '볼륨', 'Volumen', 'Volume', 'Lautstärke', 'Громкость', 'Volume')
r('cat.audio', '音频 / 喇叭与功放 Audio', 'Audio: speakers & amplifiers', 'オーディオ：スピーカーとアンプ', '오디오: 스피커와 앰프', 'Audio: altavoces y amplificadores', 'Audio : haut-parleurs et amplis', 'Audio: Lautsprecher & Verstärker', 'Аудио: динамики и усилители', 'Áudio: alto-falantes e amplificadores')
r('aud.sub.trans', '换能器 (喇叭 / 话筒)', 'Transducers (speakers / mics)', 'トランスデューサ (スピーカー/マイク)', '변환기 (스피커/마이크)', 'Transductores (altavoces / micros)', 'Transducteurs (HP / micros)', 'Wandler (Lautsprecher / Mikrofone)', 'Преобразователи (динамики / микрофоны)', 'Transdutores (alto-falantes / microfones)')
r('aud.sub.src', '音频信号源', 'Audio sources', 'オーディオ信号源', '오디오 신호원', 'Fuentes de audio', 'Sources audio', 'Audioquellen', 'Источники звука', 'Fontes de áudio')
r('aud.sub.amp', '功率放大器', 'Power amplifiers', 'パワーアンプ', '전력 증폭기', 'Amplificadores de potencia', 'Amplificateurs de puissance', 'Leistungsverstärker', 'Усилители мощности', 'Amplificadores de potência')
r('aud.burnt', '{part} 过载烧毁！', '{part} burnt out by overload!', '{part} が過負荷で焼損しました！', '{part} 과부하로 소손되었습니다!', '¡{part} se quemó por sobrecarga!', '{part} grillé par surcharge !', '{part} durch Überlast zerstört!', '{part} сгорел от перегрузки!', '{part} queimou por sobrecarga!')
r('aud.chip_burnt', '{part} 因电源电压过高而损坏！', '{part} destroyed by over-voltage on the supply!', '{part} が電源過電圧で破損しました！', '{part} 전원 과전압으로 파손되었습니다!', '¡{part} destruido por sobretensión de alimentación!', '{part} détruit par une surtension d\'alimentation !', '{part} durch Überspannung an der Versorgung zerstört!', '{part} выведен из строя перенапряжением питания!', '{part} destruído por sobretensão na alimentação!')
for k, zh, v in [
 ('r.vrms', '电压有效值', ('RMS voltage', '電圧 (実効値)', '전압 (실효값)', 'Tensión RMS', 'Tension efficace', 'Spannung (eff.)', 'Напряжение (СКЗ)', 'Tensão RMS')),
 ('r.irms', '电流有效值', ('RMS current', '電流 (実効値)', '전류 (실효값)', 'Corriente RMS', 'Courant efficace', 'Strom (eff.)', 'Ток (СКЗ)', 'Corrente RMS')),
 ('r.power', '功率 / 额定', ('Power / rated', '電力 / 定格', '전력 / 정격', 'Potencia / nominal', 'Puissance / nominale', 'Leistung / Nenn', 'Мощность / номинал', 'Potência / nominal')),
 ('r.spl', '声压级 (1 m)', ('SPL (1 m)', '音圧レベル (1 m)', '음압 레벨 (1 m)', 'SPL (1 m)', 'SPL (1 m)', 'Schalldruckpegel (1 m)', 'Уровень звука (1 м)', 'NPS (1 m)')),
 ('r.freq', '主频', ('Dominant tone', '主周波数', '주 주파수', 'Tono dominante', 'Tonalité dominante', 'Hauptton', 'Основной тон', 'Tom dominante')),
 ('r.left', '左声道', ('Left', '左チャンネル', '왼쪽 채널', 'Izquierdo', 'Gauche', 'Links', 'Левый', 'Esquerdo')),
 ('r.right', '右声道', ('Right', '右チャンネル', '오른쪽 채널', 'Derecho', 'Droite', 'Rechts', 'Правый', 'Direito')),
 ('r.bias', '偏置 (电压 · 电流)', ('Bias (V · I)', 'バイアス (電圧・電流)', '바이어스 (전압 · 전류)', 'Polarización (V · I)', 'Polarisation (V · I)', 'Vorspannung (U · I)', 'Смещение (U · I)', 'Polarização (V · I)')),
 ('r.sound', '声压', ('Sound pressure', '音圧', '음압', 'Presión sonora', 'Pression acoustique', 'Schalldruck', 'Звуковое давление', 'Pressão sonora')),
 ('r.acout', '交流输出', ('AC output', '交流出力', '교류 출력', 'Salida CA', 'Sortie CA', 'AC-Ausgang', 'Выход переменного тока', 'Saída CA')),
 ('r.wave', '波形', ('Waveform', '波形', '파형', 'Forma de onda', 'Forme d\'onde', 'Signalform', 'Форма сигнала', 'Forma de onda')),
 ('r.vout', '输出电压', ('Output voltage', '出力電圧', '출력 전압', 'Tensión de salida', 'Tension de sortie', 'Ausgangsspannung', 'Выходное напряжение', 'Tensão de saída')),
 ('r.zout', '输出阻抗', ('Output impedance', '出力インピーダンス', '출력 임피던스', 'Impedancia de salida', 'Impédance de sortie', 'Ausgangsimpedanz', 'Выходное сопротивление', 'Impedância de saída')),
 ('r.supply', '电源 (电压 · 电流)', ('Supply (V · I)', '電源 (電圧・電流)', '전원 (전압 · 전류)', 'Alimentación (V · I)', 'Alimentation (V · I)', 'Versorgung (U · I)', 'Питание (U · I)', 'Alimentação (V · I)')),
 ('r.vout_rms', '输出 (有效值 · 功率 · 增益)', ('Output (RMS · power · gain)', '出力 (実効値・電力・ゲイン)', '출력 (실효값 · 전력 · 이득)', 'Salida (RMS · potencia · ganancia)', 'Sortie (eff. · puissance · gain)', 'Ausgang (eff. · Leistung · Verstärkung)', 'Выход (СКЗ · мощность · усиление)', 'Saída (RMS · potência · ganho)')),
 ('r.gain', '增益', ('gain', 'ゲイン', '이득', 'ganancia', 'gain', 'Verstärkung', 'усиление', 'ganho')),
 ('r.dissipation', '耗散功率', ('Dissipation', '損失電力', '소비 전력', 'Disipación', 'Dissipation', 'Verlustleistung', 'Рассеиваемая мощность', 'Dissipação')),
 ('st.burnt', '已烧毁', ('Burnt out', '焼損', '소손됨', 'Quemado', 'Grillé', 'Zerstört', 'Сгорел', 'Queimado')),
 ('st.overload', '过载', ('Overloaded', '過負荷', '과부하', 'Sobrecarga', 'Surcharge', 'Überlast', 'Перегрузка', 'Sobrecarga')),
 ('st.playing', '发声中', ('Playing', '再生中', '재생 중', 'Sonando', 'En lecture', 'Spielt', 'Звучит', 'Tocando')),
 ('st.silent', '无声', ('Silent', '無音', '무음', 'Silencio', 'Silence', 'Still', 'Тишина', 'Silêncio')),
 ('st.chipburnt', '芯片已损坏', ('Chip destroyed', 'チップ破損', '칩 파손', 'Chip destruido', 'Puce détruite', 'Chip zerstört', 'Микросхема повреждена', 'Chip destruído')),
 ('st.standby', '待机 / 关断', ('Stand-by / shutdown', 'スタンバイ / シャットダウン', '대기 / 셧다운', 'Espera / apagado', 'Veille / arrêt', 'Standby / Abschaltung', 'Ожидание / отключено', 'Espera / desligado')),
 ('st.undervolt', '欠压 (未工作)', ('Under-voltage (off)', '低電圧 (停止)', '저전압 (정지)', 'Subtensión (apagado)', 'Sous-tension (arrêt)', 'Unterspannung (aus)', 'Пониженное напряжение (выкл.)', 'Subtensão (desligado)')),
 ('st.muted', '静音', ('Muted', 'ミュート', '음소거', 'Silenciado', 'Muet', 'Stummgeschaltet', 'Заглушен', 'Mudo')),
 ('st.thermal', '过热保护', ('Thermal shutdown', '過熱保護', '과열 보호', 'Protección térmica', 'Arrêt thermique', 'Übertemperaturschutz', 'Тепловая защита', 'Proteção térmica')),
 ('st.ilim', '限流中', ('Current limiting', '電流制限中', '전류 제한 중', 'Limitando corriente', 'Limitation de courant', 'Strombegrenzung', 'Ограничение тока', 'Limitando corrente')),
 ('st.clip', '削波 (失真)', ('Clipping (distortion)', 'クリッピング (歪み)', '클리핑 (왜곡)', 'Recorte (distorsión)', 'Écrêtage (distorsion)', 'Übersteuerung (Verzerrung)', 'Клиппинг (искажения)', 'Ceifamento (distorção)')),
 ('st.amplifying', '放大中', ('Amplifying', '増幅中', '증폭 중', 'Amplificando', 'Amplification', 'Verstärkt', 'Усиливает', 'Amplificando')),
 ('st.idle', '空闲', ('Idle', 'アイドル', '대기 중', 'En reposo', 'Au repos', 'Leerlauf', 'Покой', 'Em repouso')),
 ('st.biased', '已偏置', ('Biased', 'バイアス済み', '바이어스됨', 'Polarizado', 'Polarisé', 'Vorgespannt', 'Смещён', 'Polarizado')),
 ('st.nobias', '无偏置 (需要上拉电阻)', ('No bias (needs a pull-up resistor)', 'バイアスなし (プルアップ抵抗が必要)', '바이어스 없음 (풀업 저항 필요)', 'Sin polarización (necesita resistencia pull-up)', 'Pas de polarisation (résistance de rappel requise)', 'Keine Vorspannung (Pull-up-Widerstand nötig)', 'Нет смещения (нужен подтягивающий резистор)', 'Sem polarização (precisa de resistor pull-up)')),
]:
    r('aud.' + k, zh, *v)
# ---- property labels
r('pot.p.taper', '阻值曲线 Taper', 'Taper', 'テーパー', '테이퍼', 'Curva (taper)', 'Courbe (taper)', 'Kennlinie (Taper)', 'Характеристика (taper)', 'Curva (taper)')
r('pot.o.taper.lin', 'B 型 线性 Linear', 'B – linear', 'B型 リニア', 'B형 선형', 'B – lineal', 'B – linéaire', 'B – linear', 'B – линейная', 'B – linear')
r('pot.o.taper.log', 'A 型 对数 (音频) Audio', 'A – logarithmic (audio)', 'A型 対数 (オーディオ)', 'A형 로그 (오디오)', 'A – logarítmica (audio)', 'A – logarithmique (audio)', 'A – logarithmisch (Audio)', 'A – логарифмическая (аудио)', 'A – logarítmica (áudio)')
def p(k, zh, *v): r('aud.p.' + k, zh, *v)
p('Z', '额定阻抗', 'Rated impedance', '定格インピーダンス', '정격 임피던스', 'Impedancia nominal', 'Impédance nominale', 'Nennimpedanz', 'Номинальное сопротивление', 'Impedância nominal')
p('Prated', '额定功率', 'Rated power', '定格電力', '정격 전력', 'Potencia nominal', 'Puissance nominale', 'Nennleistung', 'Номинальная мощность', 'Potência nominal')
p('PratedCh', '额定功率 (每声道)', 'Rated power (per channel)', '定格電力 (チャンネルあたり)', '정격 전력 (채널당)', 'Potencia nominal (por canal)', 'Puissance nominale (par canal)', 'Nennleistung (je Kanal)', 'Номинальная мощность (на канал)', 'Potência nominal (por canal)')
p('Lvc', '音圈电感', 'Voice-coil inductance', 'ボイスコイルのインダクタンス', '보이스코일 인덕턴스', 'Inductancia de la bobina', 'Inductance de la bobine', 'Schwingspuleninduktivität', 'Индуктивность звуковой катушки', 'Indutância da bobina')
p('sens', '灵敏度 (1 W / 1 m)', 'Sensitivity (1 W / 1 m)', '感度 (1 W / 1 m)', '감도 (1 W / 1 m)', 'Sensibilidad (1 W / 1 m)', 'Sensibilité (1 W / 1 m)', 'Wirkungsgrad (1 W / 1 m)', 'Чувствительность (1 Вт / 1 м)', 'Sensibilidade (1 W / 1 m)')
p('sens_mw', '灵敏度 (1 mW)', 'Sensitivity (1 mW)', '感度 (1 mW)', '감도 (1 mW)', 'Sensibilidad (1 mW)', 'Sensibilité (1 mW)', 'Wirkungsgrad (1 mW)', 'Чувствительность (1 мВт)', 'Sensibilidade (1 mW)')
p('pan', '声像位置 (-1 左 … +1 右)', 'Pan (-1 left … +1 right)', 'パン (-1 左 … +1 右)', '패닝 (-1 왼쪽 … +1 오른쪽)', 'Panorama (-1 izq. … +1 der.)', 'Panoramique (-1 gauche … +1 droite)', 'Panorama (-1 links … +1 rechts)', 'Баланс (-1 влево … +1 вправо)', 'Panorama (-1 esq. … +1 dir.)')
p('Cp', '电容', 'Capacitance', '静電容量', '정전 용량', 'Capacidad', 'Capacité', 'Kapazität', 'Ёмкость', 'Capacitância')
p('esr', '串联电阻 ESR', 'Series resistance (ESR)', '直列抵抗 (ESR)', '직렬 저항 (ESR)', 'Resistencia serie (ESR)', 'Résistance série (ESR)', 'Serienwiderstand (ESR)', 'Последовательное сопротивление (ESR)', 'Resistência série (ESR)')
p('fr', '谐振频率', 'Resonant frequency', '共振周波数', '공진 주파수', 'Frecuencia de resonancia', 'Fréquence de résonance', 'Resonanzfrequenz', 'Резонансная частота', 'Frequência de ressonância')
p('Vmax', '最大电压', 'Maximum voltage', '最大電圧', '최대 전압', 'Tensión máxima', 'Tension maximale', 'Maximale Spannung', 'Максимальное напряжение', 'Tensão máxima')
p('Ib', '偏置电流 (2.2 kΩ 时)', 'Bias current (at 2.2 kΩ)', 'バイアス電流 (2.2 kΩ 時)', '바이어스 전류 (2.2 kΩ 기준)', 'Corriente de polarización (a 2,2 kΩ)', 'Courant de polarisation (à 2,2 kΩ)', 'Vorspannungsstrom (bei 2,2 kΩ)', 'Ток смещения (при 2,2 кОм)', 'Corrente de polarização (a 2,2 kΩ)')
p('msens', '灵敏度 (dBV/Pa, 2.2 kΩ)', 'Sensitivity (dBV/Pa, 2.2 kΩ)', '感度 (dBV/Pa, 2.2 kΩ)', '감도 (dBV/Pa, 2.2 kΩ)', 'Sensibilidad (dBV/Pa, 2,2 kΩ)', 'Sensibilité (dBV/Pa, 2,2 kΩ)', 'Empfindlichkeit (dBV/Pa, 2,2 kΩ)', 'Чувствительность (дБВ/Па, 2,2 кОм)', 'Sensibilidade (dBV/Pa, 2,2 kΩ)')
p('sound_on', '声音输入 开', 'Sound input on', '音声入力 オン', '음향 입력 켜기', 'Entrada de sonido activada', 'Entrée sonore activée', 'Schalleingang an', 'Звуковой вход включён', 'Entrada de som ligada')
p('src', '声源波形', 'Sound source waveform', '音源の波形', '음원 파형', 'Forma de onda de la fuente', 'Forme d\'onde de la source', 'Signalform der Schallquelle', 'Форма сигнала источника', 'Forma de onda da fonte')
p('spl', '声压级 SPL (94 dB = 1 Pa)', 'Sound pressure level (94 dB = 1 Pa)', '音圧レベル SPL (94 dB = 1 Pa)', '음압 레벨 SPL (94 dB = 1 Pa)', 'Nivel de presión sonora (94 dB = 1 Pa)', 'Niveau de pression acoustique (94 dB = 1 Pa)', 'Schalldruckpegel (94 dB = 1 Pa)', 'Уровень звукового давления (94 дБ = 1 Па)', 'Nível de pressão sonora (94 dB = 1 Pa)')
p('srcf', '声源频率', 'Sound source frequency', '音源の周波数', '음원 주파수', 'Frecuencia de la fuente', 'Fréquence de la source', 'Frequenz der Schallquelle', 'Частота источника', 'Frequência da fonte')
p('wave', '波形', 'Waveform', '波形', '파형', 'Forma de onda', 'Forme d\'onde', 'Signalform', 'Форма сигнала', 'Forma de onda')
p('Vpp', '幅度 (峰峰值)', 'Amplitude (peak-to-peak)', '振幅 (ピークツーピーク)', '진폭 (피크 대 피크)', 'Amplitud (pico a pico)', 'Amplitude (crête à crête)', 'Amplitude (Spitze-Spitze)', 'Амплитуда (размах)', 'Amplitude (pico a pico)')
p('freq', '频率 (扫频起点)', 'Frequency (sweep start)', '周波数 (スイープ開始)', '주파수 (스윕 시작)', 'Frecuencia (inicio del barrido)', 'Fréquence (début du balayage)', 'Frequenz (Sweep-Start)', 'Частота (начало свипа)', 'Frequência (início da varredura)')
p('freq2', '第二频率 / 扫频终点', 'Second frequency / sweep end', '第2周波数 / スイープ終了', '두 번째 주파수 / 스윕 끝', 'Segunda frecuencia / fin del barrido', 'Seconde fréquence / fin du balayage', 'Zweite Frequenz / Sweep-Ende', 'Вторая частота / конец свипа', 'Segunda frequência / fim da varredura')
p('tsw', '扫频周期', 'Sweep period', 'スイープ周期', '스윕 주기', 'Periodo del barrido', 'Période de balayage', 'Sweep-Dauer', 'Период свипа', 'Período da varredura')
p('dc', '直流偏置', 'DC offset', 'DC オフセット', 'DC 오프셋', 'Offset de CC', 'Décalage CC', 'DC-Offset', 'Постоянное смещение', 'Offset CC')
p('zs', '源阻抗', 'Source impedance', '信号源インピーダンス', '소스 임피던스', 'Impedancia de fuente', 'Impédance de source', 'Quellenimpedanz', 'Выходное сопротивление источника', 'Impedância da fonte')
p('playing', '输出信号', 'Output signal', '出力信号', '출력 신호', 'Señal de salida', 'Signal de sortie', 'Ausgangssignal', 'Выходной сигнал', 'Sinal de saída')
p('freqL', '左声道频率', 'Left channel frequency', '左チャンネルの周波数', '왼쪽 채널 주파수', 'Frecuencia del canal izquierdo', 'Fréquence du canal gauche', 'Frequenz linker Kanal', 'Частота левого канала', 'Frequência do canal esquerdo')
p('freqR', '右声道频率 (0 = 同左)', 'Right channel frequency (0 = same as left)', '右チャンネルの周波数 (0 = 左と同じ)', '오른쪽 채널 주파수 (0 = 왼쪽과 동일)', 'Frecuencia del canal derecho (0 = igual al izquierdo)', 'Fréquence du canal droit (0 = comme la gauche)', 'Frequenz rechter Kanal (0 = wie links)', 'Частота правого канала (0 = как левый)', 'Frequência do canal direito (0 = igual ao esquerdo)')
p('ver', '型号', 'Variant', 'バージョン', '버전', 'Versión', 'Version', 'Variante', 'Вариант', 'Versão')
p('rth', '热阻 (芯片到环境)', 'Thermal resistance (junction to ambient)', '熱抵抗 (接合部〜周囲)', '열저항 (접합부-주위)', 'Resistencia térmica (unión–ambiente)', 'Résistance thermique (jonction–ambiante)', 'Wärmewiderstand (Sperrschicht–Umgebung)', 'Тепловое сопротивление (кристалл–среда)', 'Resistência térmica (junção–ambiente)')
p('rth_sink', '热阻 (芯片到环境, 含散热片)', 'Thermal resistance (junction to ambient, with heat sink)', '熱抵抗 (接合部〜周囲、ヒートシンク込み)', '열저항 (접합부-주위, 방열판 포함)', 'Resistencia térmica (unión–ambiente, con disipador)', 'Résistance thermique (jonction–ambiante, avec radiateur)', 'Wärmewiderstand (Sperrschicht–Umgebung, mit Kühlkörper)', 'Тепловое сопротивление (кристалл–среда, с радиатором)', 'Resistência térmica (junção–ambiente, com dissipador)')
p('vol', '音量电位器 (对数)', 'Volume pot (logarithmic)', 'ボリューム (対数)', '볼륨 가변저항 (로그)', 'Potenciómetro de volumen (logarítmico)', 'Potentiomètre de volume (logarithmique)', 'Lautstärkepoti (logarithmisch)', 'Регулятор громкости (логарифмический)', 'Potenciômetro de volume (logarítmico)')
p('gdb', '增益 (GAIN/SLV 引脚)', 'Gain (GAIN/SLV pin)', 'ゲイン (GAIN/SLV ピン)', '이득 (GAIN/SLV 핀)', 'Ganancia (pin GAIN/SLV)', 'Gain (broche GAIN/SLV)', 'Verstärkung (Pin GAIN/SLV)', 'Усиление (вывод GAIN/SLV)', 'Ganho (pino GAIN/SLV)')
# ---- options (language-neutral numbers keep the same text)
def same(k, s): r(k, s, *([s] * 8))
for z in (4, 8, 16, 32, 64, 150): same('aud.o.Z.%d' % z, '%d Ω' % z)
for z in (32, 100, 600): same('aud.o.zsj.%d' % z, '%d Ω' % z)
same('aud.o.zsj.10000', '10 kΩ'); same('aud.o.zs.50', '50 Ω'); same('aud.o.zs.600', '600 Ω'); same('aud.o.zs.10000', '10 kΩ')
r('aud.o.zs.0', '0 Ω (理想)', '0 Ω (ideal)', '0 Ω (理想)', '0 Ω (이상)', '0 Ω (ideal)', '0 Ω (idéal)', '0 Ω (ideal)', '0 Ω (идеальный)', '0 Ω (ideal)')
same('aud.o.lm386ver.N-1', 'LM386N-1 (4–12 V)'); same('aud.o.lm386ver.N-3', 'LM386N-3 (4–12 V)'); same('aud.o.lm386ver.N-4', 'LM386N-4 (5–18 V)')
same('aud.o.tdaver.TDA2030', 'TDA2030 (max 36 V)'); same('aud.o.tdaver.TDA2030A', 'TDA2030A (max 44 V)')
for g, a in ((20, '10×'), (26, '20×'), (32, '40×'), (36, '63×')): same('aud.o.gdb.%d' % g, '%d dB (%s)' % (g, a))
W = {'sine': ('正弦波 Sine', 'Sine', '正弦波', '사인파', 'Seno', 'Sinus', 'Sinus', 'Синус', 'Seno'), 'triangle': ('三角波 Triangle', 'Triangle', '三角波', '삼각파', 'Triángulo', 'Triangle', 'Dreieck', 'Треугольник', 'Triângulo'),
     'square': ('方波 Square', 'Square', '矩形波', '사각파', 'Cuadrada', 'Carré', 'Rechteck', 'Меандр', 'Quadrada'), 'saw': ('锯齿波 Sawtooth', 'Sawtooth', 'のこぎり波', '톱니파', 'Diente de sierra', 'Dent de scie', 'Sägezahn', 'Пила', 'Dente de serra'),
     'sweep': ('扫频 Sweep', 'Sweep', 'スイープ', '스윕', 'Barrido', 'Balayage', 'Sweep', 'Свип', 'Varredura'), 'noise': ('白噪声 White noise', 'White noise', 'ホワイトノイズ', '백색 잡음', 'Ruido blanco', 'Bruit blanc', 'Weißes Rauschen', 'Белый шум', 'Ruído branco'),
     'twotone': ('双音 Two-tone', 'Two-tone', '2トーン', '투톤', 'Dos tonos', 'Bi-ton', 'Zweiton', 'Два тона', 'Dois tons')}
for k, v in W.items():
    r('aud.o.wave.' + k, *v); r('aud.o.src.' + k, *v)
# ---- parts: name / desc
def part(t, zhn, zhd, en_n, ja_n, ko_n, es_n, fr_n, de_n, ru_n, pt_n, en_d, ja_d, ko_d, es_d, fr_d, de_d, ru_d, pt_d):
    r('c.%s.name' % t, zhn, en_n, ja_n, ko_n, es_n, fr_n, de_n, ru_n, pt_n)
    r('c.%s.desc' % t, zhd, en_d, ja_d, ko_d, es_d, fr_d, de_d, ru_d, pt_d)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen-aud-i18n-parts.py'), encoding='utf-8').read())
# ---- emit
import opencc
cc = opencc.OpenCC('s2twp')
def js(d, code, hdr):
    lines = ['// v14 audio / speakers / power amplifiers — %s (generated by tools/gen-aud-i18n.py)' % hdr, 'I18N.add(%s, {' % json.dumps(code)]
    items = list(d.items())
    for i, (k, v) in enumerate(items): lines.append('  %s: %s%s' % (json.dumps(k), json.dumps(v, ensure_ascii=False), ',' if i < len(items) - 1 else ''))
    lines.append('});'); return '\n'.join(lines) + '\n'
dicts = {c: {} for c in ['zh-CN', 'zh-TW'] + L}
for row in R:
    k, zh = row[0], row[1]
    dicts['zh-CN'][k] = zh
    dicts['zh-TW'][k] = cc.convert(zh)
    for c, v in zip(L, row[2:]): dicts[c][k] = v
os.makedirs(OUT, exist_ok=True)
for c, d in dicts.items(): open(os.path.join(OUT, c + '.js'), 'w', encoding='utf-8').write(js(d, c, c))
print('keys', len(R))
