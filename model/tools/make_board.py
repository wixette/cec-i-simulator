"""Generate model/params/board.json: the main board's parts, read off its photograph.

    python3 -I model/tools/make_board.py

Source: a photograph of the main board from above (images/photos/mainboard-top.jpg is a
copy), read at a fixed crop and scale: the readings below are pixel boxes in that view
(gx0, gx1, gy0, gy1), the board's corners at (40, 35) and (1150, 1010), so 4.05 px/mm
across and 4.15 down for the measured 274 x 235 mm board. The chips' markings were read
off the board itself. Positions are in the board frame: bx right and by toward the front
from the board's back-left corner (machine.json main_board.back_left), mm. Heights above
the board measured (a DIP 8, J1 14, RF-1 17, the tallest capacitor 17); the rest estimated.
Never edit board.json by hand.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

X0, Y0, SX, SY = 40.0, 35.0, 4.05, 4.15

# ref, kind, (gx0, gx1, gy0, gy1), height, label, extra
PARTS = [
    # the 40-pin chips
    ("U1", "dip40", (220, 280, 420, 660), 8.0, "U1: the 6502 processor (marked N3065)", {}),
    ("U15", "dip40", (520, 585, 440, 660), 8.0, "U15: IOU, the input/output and video controller (marked 4005/AA; the books' IOU 4007)", {}),
    ("U4", "dip40", (650, 715, 440, 660), 8.0, "U4: MMU, the memory manager (marked 4001/AA; the books' MMU 4006)", {}),
    ("U25", "dip40", (985, 1050, 720, 945), 8.0, "U25: GI KB3600-PRO, the keyboard encoder", {}),
    # the ROMs
    ("U7", "dip28", (65, 125, 745, 900), 8.0, "U7: EPROM 27256, the system ROM (BASIC, the monitor, the Chinese system's entry)", {}),
    ("U35", "dip28", (175, 235, 745, 900), 8.0, "U35: EPROM 27256, the Chinese system's tables and code", {}),
    ("U34", "dip28", (275, 340, 745, 900), 8.0, "U34: font ROM CECWL II (Macronix MX231024-0060): half of the 16 x 16 Chinese font", {}),
    ("U33", "dip28", (380, 445, 745, 900), 8.0, "U33: font ROM CECWL I (Macronix MX231024-0059): the other half of the font", {}),
    ("U13", "dip24", (895, 955, 425, 555), 8.0, "U13: GI 9433C-0202, the character ROM (the 96 letters, digits and signs, and the graphics patterns)", {}),
    ("U26", "dip24", (885, 945, 830, 965), 8.0, "U26: GI 9433C-0201, the keyboard ROM", {}),
    ("U17", "dip20", (760, 795, 440, 550), 8.0, "U17: the timing PAL (marked 8100/AA; the books' PAL 4008)", {}),
    ("U5", "dip18", (420, 455, 560, 655), 8.0, "U5: OKI M41464 dynamic RAM, 64K x 4 (the low 4 bits of every byte)", {}),
    ("U6", "dip18", (345, 380, 560, 655), 8.0, "U6: OKI M41464 dynamic RAM, 64K x 4 (the high 4 bits)", {}),
    ("U30", "dip16", (400, 440, 205, 300), 8.0, "U30: TCA650, the PAL colour modulator", {}),
    ("U32", "dip16", (520, 555, 720, 800), 8.0, "U32: 74LS174, the $C0B0 latch: font bank, colour on, table bank", {}),
    ("U19", "dip16", (715, 750, 860, 945), 8.0, "U19: NE558, four timers (the game paddles)", {}),
    # the other chips: their refs from the book (cec-i-docs, ch. 4, fig. 4-1 and table 4-1), checked
    # against the board's own printing on the photograph where it can be read; named by BOOK below
    ("U39", "dip16", (665, 700, 60, 165), 8.0, "", {}),
    ("U41", "dip16", (740, 775, 75, 165), 8.0, "", {}),
    ("U42", "dip16", (815, 850, 75, 165), 8.0, "", {}),
    ("U40", "dip16", (900, 935, 70, 185), 8.0, "", {}),
    ("U43", "dip14", (975, 1010, 70, 160), 8.0, "", {}),
    ("U44", "dip14", (1050, 1090, 70, 160), 8.0, "", {}),
    ("U27", "dip14", (70, 110, 285, 360), 8.0, "", {}),
    ("U28", "dip16", (145, 185, 290, 370), 8.0, "", {}),
    ("U29", "dip14", (270, 305, 285, 360), 8.0, "", {}),
    ("U36", "dip14", (650, 685, 320, 395), 8.0, "", {}),
    ("U38", "dip14", (740, 775, 315, 395), 8.0, "", {}),
    ("U18", "dip8", (925, 960, 340, 390), 8.0, "", {}),
    ("U45", "dip8", (925, 960, 253, 303), 8.0, "", {}),   # as U18, 21 mm behind it (as photographed)
    ("U2", "dip20", (150, 190, 420, 520), 8.0, "", {}),
    ("U10", "dip14", (345, 380, 440, 520), 8.0, "", {}),
    ("U11", "dip14", (420, 455, 440, 520), 8.0, "", {}),
    ("U12", "dip16", (830, 865, 440, 550), 8.0, "", {}),
    ("U14", "dip16", (1000, 1035, 440, 550), 8.0, "", {}),
    ("U3", "dip20", (150, 190, 560, 665), 8.0, "", {}),
    ("U9", "dip14", (760, 795, 585, 665), 8.0, "", {}),
    ("U16", "dip14", (830, 870, 590, 665), 8.0, "", {}),
    ("U8", "dip14", (910, 950, 590, 665), 8.0, "", {}),
    ("U37", "dip14", (1000, 1035, 590, 665), 8.0, "", {}),
    ("U20", "dip16", (620, 655, 720, 800), 8.0, "", {}),
    ("U23", "dip16", (715, 750, 720, 800), 8.0, "", {}),
    ("U22", "dip16", (800, 835, 720, 800), 8.0, "", {}),
    ("U21", "dip16", (880, 920, 720, 800), 8.0, "", {}),
    ("U31", "dip16", (520, 555, 860, 940), 8.0, "", {}),
    ("U24", "dip20", (800, 835, 860, 945), 8.0, "", {}),
    # connectors and the rest
    ("J1", "slot", (575, 865, 175, 200), 14.0, "J1: the expansion slot, under the flap in the lid", {}),
    ("J9", "header", (1056, 1100, 725, 870), 9.0, "J9: the keyboard's 26-way flat cable", {"pins": [2, 13]}),
    ("J10", "header", (1080, 1110, 560, 670), 9.0, "J10: the slot jumpers (SLOT 1-7)", {"pins": [2, 7]}),
    ("J4", "header", (530, 630, 50, 100), 9.0, "J4: the disk drive connector (驱动器), 2 x 10 pins", {"pins": [2, 10]}),
    ("J3", "din", (1060, 1160, 175, 245), 13.0, "J3: the cassette socket (录音机), DIN", {}),
    ("J2", "de9", (1060, 1150, 395, 515), 12.0, "J2: the joystick socket (游戏棒), D-sub", {}),
    ("RF1", "can", (50, 225, 35, 155), 17.0, "RF-1: the RF modulator, the picture for a TV's aerial socket (电视)", {}),
    ("SW1", "dipswitch", (475, 505, 55, 100), 6.0, "SW1?: a two-way DIP switch by the colour circuit, both OPEN (the colour/black-and-white switch, to be confirmed)", {}),
    ("Y1", "crystal", (870, 910, 330, 375), 10.0, "Y1: 14.31818 MHz, the master clock", {}),
    ("Y2", "crystal", (420, 460, 75, 115), 10.0, "Y2: 4.433619 MHz, the PAL colour subcarrier", {}),
    ("J8", "conn", (76, 108, 960, 984), 9.0, "J8: the speaker's connector, its two wires in from the top", {}),
    ("JP", "conn", (75, 110, 400, 465), 18.0, "The power connector: +5 V, +12 V and the rest from the power supply (18 mm tall)", {}),
    ("C_a", "cap_e", (182, 210, 190, 222), 12.0, "", {}),
    ("C_b", "cap_e", (480, 505, 215, 250), 11.0, "", {}),
    ("C_c", "cap_e", (978, 1002, 300, 330), 11.0, "", {}),
    ("C_d", "cap_e", (90, 115, 555, 580), 10.0, "", {}),
    ("C_e", "cap_e", (90, 115, 600, 625), 10.0, "", {}),
    ("C_f", "cap_e", (90, 115, 650, 675), 10.0, "", {}),
    ("C_g", "cap_e", (90, 115, 700, 725), 10.0, "", {}),
    ("L1", "coil", (116, 151, 530, 565), 12.0, "", {}),
    ("L2", "coil", (116, 151, 580, 615), 12.0, "", {}),
    ("L3", "coil", (116, 151, 625, 660), 12.0, "", {}),
    ("L4", "coil", (116, 151, 670, 705), 12.0, "", {}),
    ("T1", "trimmer", (230, 265, 150, 185), 9.0, "", {}),
    ("T2", "trimmer", (160, 195, 225, 260), 9.0, "", {}),
    ("T3", "trimmer", (198, 233, 225, 260), 9.0, "", {}),
    ("T4", "coil", (255, 290, 195, 230), 12.0, "", {}),
]

# the chips the book names (cec-i-docs, 02-system-principles-maintenance, ch. 4: table 4-1, fig. 4-1
# and the text after it): ref -> (type printed on the model, English name, Chinese name). The
# board's printing (on the photograph) agrees: U39 U41 U42 U40 U43 U44 along the back, U32 U20
# U23 U22 U21 along the row by the keyboard encoder. A chip whose own marking was read off the
# machine keeps that marking (build_machine.MARKINGS) and its fuller label above
BOOK = {
    "U1": ("", "", "U1：6502 中央处理器（CPU）"),
    "U2": ("74LS244", "U2: 74LS244, eight three-state buffers: the address bus", "U2：74LS244，8 个不反相三态门（地址总线驱动器）"),
    "U3": ("74LS244", "U3: 74LS244, eight three-state buffers: the address bus", "U3：74LS244，8 个不反相三态门（地址总线驱动器）"),
    "U4": ("", "", "U4：MMU4006 内存管理部件"),
    "U5": ("", "", "U5：50464 动态 RAM，4×64K"),
    "U6": ("", "", "U6：50464 动态 RAM，4×64K"),
    "U7": ("27256", "", "U7：27256 EPROM，系统 ROM"),
    "U8": ("74LS00", "U8: 74LS00, four NAND gates", "U8：74LS00，4-与非门"),
    "U9": ("74LS04", "U9: 74LS04, six inverters", "U9：74LS04，6-反相器"),
    "U10": ("74LS02", "U10: 74LS02, four NOR gates", "U10：74LS02，4-或非门"),
    "U11": ("74LS08", "U11: 74LS08, four AND gates", "U11：74LS08，4-与门"),
    "U12": ("74LS374", "U12: 74LS374, eight D flip-flops, three-state outputs (the picture)", "U12：74LS374，8-三态门输出的 D 型触发器（视频）"),
    "U13": ("", "", "U13：字符 ROM（书中为 2732）"),
    "U14": ("74LS166", "U14: 74LS166, an 8-bit shift register: the picture's dots, out one by one", "U14：74LS166，8 位移位寄存器（视频）"),
    "U15": ("", "", "U15：IOU4007 输入/输出管理部件"),
    "U16": ("74S109", "U16: 74S109, two J-K flip-flops (the clocks)", "U16：74S109，J-K 触发器（时钟）"),
    "U17": ("", "", "U17：PAL4008 可编程阵列逻辑（时钟）"),
    "U18": ("MC1458", "U18: MC1458, two operational amplifiers (the recorder, the picture)", "U18：MC1458，运算放大器（录音机接口、视频）"),
    "U19": ("", "", "U19：NE558，4-单稳触发器时基电路（游戏棒）"),
    "U20": ("74LS251", "U20: 74LS251, a one-of-eight selector, three-state output (the recorder and joystick inputs)", "U20：74LS251，三态门输出的三-八译码器（录音机、游戏棒）"),
    "U21": ("74LS138", "U21: 74LS138, a three-to-eight decoder (the I/O addresses)", "U21：74LS138，三-八译码器（I/O 译码）"),
    "U22": ("74LS138", "U22: 74LS138, a three-to-eight decoder (the I/O addresses)", "U22：74LS138，三-八译码器（I/O 译码）"),
    "U23": ("74LS138", "U23: 74LS138, a three-to-eight decoder (the I/O addresses)", "U23：74LS138，三-八译码器（I/O 译码）"),
    "U24": ("74LS245", "U24: 74LS245, eight three-state bus transceivers: the data bus", "U24：74LS245，8-三态门（数据总线双向驱动器）"),
    "U25": ("", "", "U25：KB3600 键盘编码器"),
    "U26": ("", "", "U26：键盘 ROM（书中为 2716）"),
    "U27": ("74LS164", "U27: 74LS164, an 8-bit shift register, parallel out (the colour picture)", "U27：74LS164，8 位并行输出移位寄存器（彩色视频）"),
    "U28": ("74LS175", "U28: 74LS175, four D flip-flops (the colour picture)", "U28：74LS175，4-D 型触发器（彩色视频）"),
    "U29": ("74LS74", "U29: 74LS74, two D flip-flops (the colour picture)", "U29：74LS74，2-D 型触发器（彩色视频）"),
    "U30": ("", "", "U30：TCA650 彩色信号调制器"),
    "U31": ("74LS139", "U31: 74LS139, two two-to-four decoders (the memory)", "U31：74LS139，2-4 译码器（存储器切换）"),
    "U32": ("", "", "U32：74LS174，6D 触发器（$C0B0 锁存器）"),
    "U33": ("", "", "U33：CECWL I 汉字字库 ROM（一）"),
    "U34": ("", "", "U34：CECWL II 汉字字库 ROM（二）"),
    "U35": ("27256", "", "U35：27256 EPROM"),
    "U36": ("74LS02", "U36: 74LS02, four NOR gates", "U36：74LS02，4-或非门"),
    "U37": ("74LS125", "U37: 74LS125, four three-state buffers", "U37：74LS125，4-三态门（不带反相器）"),
    "U38": ("74LS10", "U38: 74LS10, three three-input NAND gates", "U38：74LS10，3-三输入与非门"),
    "U39": ("74LS323", "U39: 74LS323, an 8-bit two-way shift register (the disk drive)", "U39：74LS323，8 位通用双向移位寄存器（软盘接口）"),
    "U40": ("256x8 PROM", "U40: a 256 x 8 PROM (the disk drive)", "U40：256×8 PROM（软盘接口）"),
    "U41": ("74LS259", "U41: 74LS259, an 8-bit addressable latch (the disk drive)", "U41：74LS259，8 位可寻址锁存器（软盘接口）"),
    "U42": ("74LS174", "U42: 74LS174, six D flip-flops (the disk drive)", "U42：74LS174，6D 触发器（软盘接口）"),
    "U43": ("74LS132", "U43: 74LS132, four Schmitt-trigger NAND gates (the disk drive)", "U43：74LS132，施密特触发器（软盘接口）"),
    "U44": ("74LS05", "U44: 74LS05, six inverters, open-collector outputs (the disk drive)", "U44：74LS05，6-OC 门（软盘接口）"),
    "U45": ("555", "U45: 555, a timer", "U45：555 精密定时器"),
}


# parts measured on the machine: (width, depth) mm
SIZE = {"RF1": (42.0, 28.0),   # measured; its height 17 above the board
        # measured, each chip by its marking, with its socket: W across, D along
        "U1": (17.0, 52.0), "U15": (17.0, 52.0), "U4": (17.0, 52.0), "U25": (17.0, 52.0),
        "U13": (17.0, 30.0), "U26": (17.0, 30.0),
        "U33": (17.0, 36.0), "U34": (17.0, 36.0), "U7": (17.0, 36.0), "U35": (17.0, 36.0)}

# the small parts between the chips: resistors, capacitors, transistors and resistor
# packs, read off the photo's full-size original in the same view (gx, gy: their centres), to show
# how they spread over the board, not one by one. h: lying across, v: lying front to back.
# Standard sizes (mm, W x D): a 1/4 W resistor 6.5 x 2.4, a dipped disc capacitor 5 x 3, a film
# capacitor 4.5 x 11 lying front to back (v; h: across), a TO-92 transistor 4.6 x 3.6, a single-row resistor pack 2.5 x its length
SMALL = {"res": ((6.5, 2.4), 3.0), "disc": ((5.0, 3.0), 7.0), "film": ((4.5, 11.0), 6.0),
         "tr": ((4.6, 3.6), 5.0), "sip": ((2.5, None), 7.0)}
PASSIVES = [
    # by the RF modulator and the colour circuit (back left)
    ("res", 270, 140, "h"), ("res", 130, 205, "h"),
    *[("res", 200, y, "h") for y in (164, 174, 184)],
    *[("res", 122, y, "h") for y in (222, 232, 242)],
    ("res", 310, 150, "v"), ("res", 322, 322, "v"), ("res", 117, 315, "v"),
    *[("res", 220, 288 + 10 * i, "h") for i in range(8)],
    *[("res", 372, y, "h") for y in (205, 265, 275, 287)],
    ("res", 485, 265, "h"), ("res", 485, 277, "h"),
    ("res", 375, 315, "h"), ("res", 375, 332, "h"), ("res", 428, 315, "h"), ("res", 428, 332, "h"),
    ("disc", 365, 92, "h"), ("film", 342, 137, "h"), ("disc", 425, 157, "h"),
    ("disc", 366, 222, "h"), ("disc", 366, 242, "h"), ("film", 475, 300, "h"),
    *[("tr", x, y, "h") for x, y in ((150, 177), (352, 177), (315, 217), (317, 250), (465, 165), (280, 172))],
    ("sip", 300, 445, "v", 12.0),
    # by the crystal Y1, U18 and U45 (the recorder, the clock)
    ("res", 953, 150, "v"), ("tr", 970, 180, "h"),
    *[("res", 995, y, "h") for y in (275, 285, 295, 342, 352, 362, 372, 382)],
    ("res", 1097, 275, "h"), ("res", 1097, 287, "h"),
    *[("res", 872, y, "h") for y in (302, 312, 322)],
    ("disc", 822, 302, "h"), ("disc", 822, 317, "h"),
    ("res", 835, 366, "h"), ("res", 835, 378, "h"),
    ("tr", 810, 350, "h"), ("tr", 850, 350, "h"),
    ("res", 748, 507, "v"),
    # by the RAM
    ("res", 388, 562, "v"), ("res", 463, 560, "v"),
    # the speaker's corner (front left)
    ("res", 152, 927, "h"), ("res", 152, 937, "h"), ("disc", 147, 952, "h"), ("disc", 147, 975, "h"),
    ("tr", 100, 947, "h"),
    # by the joystick timer U19 and the I/O decoders
    *[("res", 633 + 10 * i, 872, "v") for i in range(7)],
    *[("film", 610 + 19 * i, 920, "v") for i in range(5)],
    ("sip", 771, 882, "v", 16.0), ("res", 787, 747, "v"),
    ("sip", 1041, 527, "v", 16.0), ("res", 961, 617, "v"), ("disc", 1032, 680, "h"),
    ("res", 1015, 960, "h"), ("res", 1015, 970, "h"),
    # C75 and C76, in front of J9
    ("disc", 1090, 916, "h"), ("disc", 1113, 913, "h"),
]

# the narrow chips (rows 7.62 mm apart, 8 to 20 pins) all one width with their sockets
# ("9-9.5 depending on each measurement"; 9 as measured for U39-U44)
NARROW = ("dip8", "dip14", "dip16", "dip18", "dip20")
DIP_W = 9.0
# and their lengths by pin count: the standard plastic DIP's body (TI's N and P
# packages: 8 pins 9.8 mm, 14 and 16 pins 19.3, 18 pins 22.9, 20 pins 24.7-25.4) with its socket,
# as measured on U39-U44 (14 and 16 pins 20, 20 pins 25)
DIP_L = {8: 10.5, 14: 20.0, 16: 20.0, 18: 23.0, 20: 25.0}
# each narrow chip's pins, from its type's datasheet (BOOK; U40, the 256 x 8 PROM, 20 as its
# measured 25 mm shows)
PINS = {"U2": 20, "U3": 20, "U5": 18, "U6": 18, "U8": 14, "U9": 14, "U10": 14, "U11": 14, "U12": 20,
        "U14": 16, "U16": 16, "U17": 20, "U18": 8, "U19": 16, "U20": 16, "U21": 16, "U22": 16,
        "U23": 16, "U24": 20, "U27": 14, "U28": 16, "U29": 14, "U30": 16, "U31": 16, "U32": 16,
        "U36": 14, "U37": 14, "U38": 14, "U39": 20, "U40": 20, "U41": 16, "U42": 16, "U43": 14,
        "U44": 14, "U45": 8}

# parts placed by measurement in the machine's frame (mm): (x0, y0, x1, y1), height. The board's back edge is at Y 133, its right edge
# at X 176.08 (params main_board). J1: 70 x 9 x 15, its back edge 36 from the board's back edge
# (33 measured; 36 to centre it under the lid's flap), its right end 70 from the board's
# right edge. The six chips above it: 9 wide, 25/20/20/25/20/20 deep, placed along it from the
# photo with J1 as the scale, lined up as on the real machine
PX0, PY0 = -94.3, 124.7            # main_board.parts_origin: board.json's frame
_J1 = (176.08 - 70 - 70, 133 - 36 - 9, 176.08 - 70, 133 - 36)
_CHIPS = {"U39": (61.9, 25), "U41": (79.8, 20), "U42": (99.0, 20), "U40": (118.4, 25), "U43": (137.5, 20), "U44": (155.2, 20)}
WORLD = {"J1": (_J1, 15.0)}
# the real machine's layout: the first chip's back end 4 from the board's back edge;
# the 2nd and 3rd lined up with its front end; the 4th to 6th lined up with their back ends
_front = 133 - 4.0 - 25                               # the first chip's front end
_back = _front + 20                                   # the 2nd and 3rd chips' back ends
for _i, (_ref, (_cx, _d)) in enumerate(_CHIPS.items()):
    _y0, _y1 = (_front, _front + _d) if _i < 3 else (_back - _d, _back)
    WORLD[_ref] = ((_cx - 4.5, _y0, _cx + 4.5, _y1), 8.0)


# the Chinese labels of the parts that have no entry in BOOK (the connectors, the crystals)
ZH = {
    "J1": "J1：扩充槽，在上盖的盖板下面",
    "J2": "J2：游戏棒插座，D 型",
    "J3": "J3：录音机插座，DIN 型",
    "J4": "J4：驱动器接口，2 × 10 针",
    "J8": "J8：喇叭插座，两根线从上面插入",
    "J9": "J9：键盘的 26 芯扁平电缆插座",
    "J10": "J10：扩充槽跳线（SLOT 1-7）",
    "JP": "电源插座：电源送来的 +5 V、+12 V 等电压（高 18 毫米）",
    "RF1": "RF-1：射频调制器，把图像送到电视机的天线插座（电视）",
    "SW1": "SW1？：彩色电路旁的两位拨动开关，都在 OPEN（彩色 / 黑白开关，有待确认）",
    "Y1": "Y1：14.31818 MHz，主时钟晶振",
    "Y2": "Y2：4.433619 MHz，PAL 彩色副载波晶振",
}


def main():
    out = []
    n = 0
    for ref, kind, (gx0, gx1, gy0, gy1), h, label, extra in PARTS:
        src = ref                            # the reading's own ref, for WORLD and SIZE
        extra = dict(extra)
        if ref in BOOK:
            mark, en, zh = BOOK[ref]
            label = label or en
            extra["label_zh"] = zh
            if mark:
                extra["marking"] = [mark]
        elif ref in ZH:
            extra["label_zh"] = ZH[ref]
        if not label:
            # not yet identified on the photo: no designator is claimed for it
            n += 1
            ref = f"x{n:02d}"
        bx0, bx1 = (gx0 - X0) / SX, (gx1 - X0) / SX
        by0, by1 = (gy0 - Y0) / SY, (gy1 - Y0) / SY
        if src in WORLD:                     # measured in the machine's frame
            (wx0, wy0, wx1, wy1), h = WORLD[src]
            bx0, bx1, by0, by1 = wx0 - PX0, wx1 - PX0, PY0 - wy1, PY0 - wy0
        if src in PINS:
            kind = f"dip{PINS[src]}"
        if kind in NARROW and src not in SIZE and src not in WORLD:
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2    # one width for all, the length by the pins, kept centred
            ln = DIP_L[PINS.get(src, int(kind[3:]))]
            bx0, bx1, by0, by1 = cx - DIP_W / 2, cx + DIP_W / 2, cy - ln / 2, cy + ln / 2
        if src in SIZE:                      # measured: kept centred where the photo puts it
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            w, d = SIZE[src]
            bx0, bx1, by0, by1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
        p = {"ref": ref, "kind": kind, "box": [round(bx0, 1), round(by0, 1), round(bx1, 1), round(by1, 1)], "height": h, "label": label}
        p.update(extra)
        out.append(p)
    for kind, gx, gy, o, *ln in PASSIVES:
        (w, d), h = SMALL[kind]
        if d is None:
            d = ln[0]
        if (o == "v") != (kind == "film") and kind != "sip":
            w, d = d, w
        cx, cy = (gx - X0) / SX, (gy - Y0) / SY
        n += 1
        out.append({"ref": f"x{n:02d}", "kind": kind, "box": [round(cx - w / 2, 1), round(cy - d / 2, 1), round(cx + w / 2, 1), round(cy + d / 2, 1)], "height": h, "label": ""})
    doc = {
        "_generated": "by model/tools/make_board.py from images/photos/mainboard-top.jpg; do not edit",
        "frame": "board frame: bx right, by toward the front, from the board's back-left corner (mm); box = [bx0, by0, bx1, by1]",
        "count": len(out),
        "parts": out,
    }
    with open(os.path.join(ROOT, "params", "board.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"board.json: {len(out)} parts")


if __name__ == "__main__":
    main()
