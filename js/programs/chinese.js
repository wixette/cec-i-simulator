// SPDX-License-Identifier: Apache-2.0
//
// Chinese (design/v0.0.3.md, P1): programs in the Chinese system, their text in Chinese. A
// Chinese character in a BASIC string is three bytes, 127 and two more (js/sim/chinese.js), so
// LEN and MID$ count three to a character; typed in, each goes in through 区位, as Type in does.

import { quwei } from "../sim/chinese.js";

/** @typedef {import("../sim/samples.js").Sample} Sample */

/** @type {Sample[]} */
export const CHINESE = [
  {
    id: "idioms",
    section: "chinese",
    mode: "chinese",
    text: `10 DIM I$(20),P(20),W$(20,2),U(20),C$(3):FOR K=1 TO 20:READ I$(K),P(K),W$(K,1),W$(K,2):NEXT
20 X=RND(-(PEEK(78)+256*PEEK(79)))
30 HOME:PRINT "成语填空":PRINT:PRINT "每个成语缺一个字，"
40 PRINT "从三个字里选出它来。":PRINT "一共十题。":PRINT:PRINT "按任意键开始";:GET A$
50 S=0:FOR K=1 TO 20:U(K)=0:NEXT
60 FOR Q=1 TO 10
70 K=INT(RND(1)*20)+1:IF U(K) THEN 70
80 U(K)=1:L=(P(K)-1)*3+1:R$=MID$(I$(K),L,3)
90 B$=LEFT$(I$(K),L-1)+"□"+MID$(I$(K),L+3)
100 R=INT(RND(1)*3)+1:J=1:FOR N=1 TO 3:IF N=R THEN C$(N)=R$:GOTO 120
110 C$(N)=W$(K,J):J=J+1
120 NEXT
130 HOME:PRINT "第 ";Q;" 题        答对 ";S;" 题":PRINT:PRINT "    ";B$:PRINT
140 PRINT " 1 ";C$(1);"   2 ";C$(2);"   3 ";C$(3):PRINT
150 PRINT "选哪一个（1-3）？";
160 GET A$:A=ASC(A$)-48:IF A<1 OR A>3 THEN 160
170 PRINT A:IF A=R THEN S=S+1:PRINT "对了！";I$(K):MUSIC 108,40:MUSIC 81,60:GOTO 190
180 PRINT "不对，是“";R$;"”：";I$(K):MUSIC 215,80
190 PRINT "按任意键接着来";:GET A$:NEXT Q
200 HOME:PRINT "十题答对了 ";S;" 题。":PRINT
210 IF S=10 THEN PRINT "满分！真了不起。"
220 IF S>6 AND S<10 THEN PRINT "很好！"
230 IF S>3 AND S<7 THEN PRINT "不错，再接再厉。"
240 IF S<4 THEN PRINT "多读读成语故事吧。"
250 PRINT:PRINT "再来一次吗（Y/N）？";:GET A$:IF A$="Y" THEN 50
260 HOME:END
1000 DATA "画蛇添足",4,"手","尾","守株待兔",4,"鹿","马","亡羊补牢",2,"牛","马"
1010 DATA "对牛弹琴",3,"拉","唱","井底之蛙",4,"鱼","龟","狐假虎威",3,"狼","豹"
1020 DATA "掩耳盗铃",4,"钟","鼓","刻舟求剑",2,"船","车","杯弓蛇影",2,"箭","刀"
1030 DATA "拔苗助长",2,"草","树","守口如瓶",4,"罐","碗","一箭双雕",3,"三","两"
1040 DATA "三心二意",3,"一","两","半途而废",2,"路","道","胸有成竹",4,"林","木"
1050 DATA "卧薪尝胆",3,"吃","食","愚公移山",4,"石","海","叶公好龙",4,"虎","凤"
1060 DATA "画龙点睛",4,"眼","目","自相矛盾",3,"刀","剑"`,
  },
  {
    id: "wordproc",
    section: "chinese",
    mode: "chinese",
    text: `10 HIMEM:16384:A=24576
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 HOME:PRINT "文字处理":PRINT
40 PRINT "一个最简单的全屏幕中文编辑器。"
50 PRINT "方向键：移动光标"
60 PRINT "F3：区位输入，四位数字一个字"
70 PRINT "F1：回到字母  F2：删去前一个字"
80 PRINT "Return：另起一行  Quit：结束"
90 PRINT:PRINT "按任意键开始";:GET A$:CALL 24576
100 HOME:PRINT "再编辑一次吗（Y/N）？";:GET A$:IF A$="Y" THEN CALL 24579:GOTO 100
110 HOME:END`,
    code: {
      org: 24576,
      line: 1000,
      source: `; The word processor: a whole screen of Chinese text, edited anywhere, in the
; manner of WordStar and WPS. All in machine code: BASIC only shows the help.
; It draws its own screen on hi-res page 2, the Chinese system's: every
; character 16 x 16 dots from the font, 17 to a line, 10 lines, and a line of
; status under them. A letter or a digit is the full-width one of GB 2312's
; row 3. The text is two bytes a character, its 区位 row and place; a new line
; is 0, 13. Keys: the arrows; F3 and four digits a character by 区位, F1 back to
; letters; F2 deletes the character before the cursor; Return a new line; Quit.
PTR = $06           ; a row of the screen
WIN = $08           ; a character's 32 bytes in the font's window
SHP = $19           ; the shadow of the cell being drawn
SRC = $EB           ; for walking and moving the text
DST = $ED
GLYPH = $340        ; a character's 32 bytes, fetched (FETCH runs at $300)
FETCHAT = $300
START = $7000       ; the text, up to $9200 (the Chinese system's HIMEM)
LIMIT = $9200
SHADOW = $6E00      ; what each of the 187 cells shows: row, place (0 empty)
BASELO = $6A80      ; each dot row's first byte on page 2, worked out at the start
BASEHI = $6B40
GBASEL = $6D00      ; each 区位 row's first glyph, worked out at the start
GBASEH = $6D60
CUR = $6C00         ; the cursor's place in the text
TOP = $6C02         ; the text at the top of the screen
ENDP = $6C04        ; the text's end
CHARS = $6C06       ; how many characters (not counting new lines)
ROWST = $6C08       ; where each of the 10 lines starts, and the 11th
ROWN = $6C20        ; how many characters each line shows
CROW = $6C2A        ; the cursor on the screen
CCOL = $6C2B
EROW = $6C2C        ; the cell being drawn
ECOL = $6C2D
GR = $6C2E          ; its character
GP = $6C2F
QW = $6C30          ; 1: typing a 区位 code
QWN = $6C31         ; its digits so far
QWD = $6C32         ; the digits, 4 bytes
SAVEZP = $6C36      ; the zero page borrowed, 10 bytes
V0 = $6C40          ; a row of dots, shifted
V1 = $6C41
V2 = $6C42
V3 = $6C43
M0 = $6C44          ; the cell's dots in its bytes
M1 = $6C45
M2 = $6C46
M3 = $6C47
CB = $6C48          ; the cell's first byte across, and its shift
CS = $6C49
RR = $6C4A          ; a dot row of the cell
Y0 = $6C4B
NUML = $6C4C        ; a number to show
NUMH = $6C4D
LINEL = $6C4E       ; the cursor's line and column, for the status
LINEH = $6C4F
COLN = $6C50
WALK = $6C51        ; the walk's column
CNT = $6C52
OLDCR = $6C53       ; where the cursor was drawn
OLDCC = $6C54
UNDER = $6C55       ; 1 draw, 0 erase
TMP = $6C56
G0 = $6C58          ; a row's four bytes, cut
G1 = $6C59
G2 = $6C5A
G3 = $6C5B
ROWE = $6C5C        ; 1 for each line of the screen that has text, or room for it (11)
LIVE = $6C67
SHOWN = $6C68
TL = $6C69
SAVEX = $6C6A
        * = $6000
        JMP NEW         ; 24576: a new text
        JMP AGAIN       ; 24579: the same text again
NEW     LDA #<START
        STA CUR
        STA TOP
        STA ENDP
        LDA #>START
        STA CUR+1
        STA TOP+1
        STA ENDP+1
        LDA #0
        STA CHARS
        STA CHARS+1
AGAIN   JSR TABLES
        LDX #3          ; borrow the zero page; FETCH to page 3
SAVE1   LDA PTR,X
        STA SAVEZP,X
        LDA SRC,X
        STA SAVEZP+4,X
        DEX
        BPL SAVE1
        LDA SHP
        STA SAVEZP+8
        LDA SHP+1
        STA SAVEZP+9
        LDX #FETCHEND-FETCH-1
COPYF   LDA FETCH,X
        STA FETCHAT,X
        DEX
        BPL COPYF
        LDA #0
        STA QW
        STA PTR         ; a clear page 2, and a shadow to match
        LDA #$40
        STA PTR+1
        LDY #0
        TYA
CLR     STA (PTR),Y
        INY
        BNE CLR
        INC PTR+1
        LDX PTR+1
        CPX #$60
        BCC CLR
        LDX #0
CLRS    STA SHADOW,X
        STA SHADOW+256,X
        INX
        BNE CLRS
        LDA #$FF
        STA OLDCR
LOOP    JSR SHOW
KEY     LDA $C000
        BPL KEY
        STA $C010
        AND #$7F
        JSR DOKEY
        BCC LOOP
        LDX #3          ; Quit: the zero page back, and to BASIC
REST1   LDA SAVEZP,X
        STA PTR,X
        LDA SAVEZP+4,X
        STA SRC,X
        DEX
        BPL REST1
        LDA SAVEZP+8
        STA SHP
        LDA SAVEZP+9
        STA SHP+1
        RTS
; a key: carry set to quit
DOKEY   LDX QW
        BEQ PLAIN
        CMP #'0'
        BCC QWOFF
        CMP #'9'+1
        BCS QWOFF
        AND #$0F        ; a digit of the 区位 code
        LDX QWN
        STA QWD,X
        INC QWN
        CPX #3
        BNE KQ
        LDA #0
        STA QWN
        LDA QWD         ; four: its row and place
        ASL A
        ASL A
        ADC QWD
        ASL A
        ADC QWD+1
        STA GR
        LDA QWD+2
        ASL A
        ASL A
        ADC QWD+2
        ASL A
        ADC QWD+3
        STA GP
        LDA GR
        BEQ KQ
        CMP #88
        BCS KQ
        CMP #10         ; rows 10-15 are empty
        BCC QROW
        CMP #16
        BCC KQ
QROW
        LDA GP
        BEQ KQ
        CMP #95
        BCS KQ
        JMP INSERT
KQ      CLC
        RTS
QWOFF   LDX #0
        STX QW
        CMP #1          ; F1 only leaves the 区位 code
        BEQ KDONE
PLAIN   CMP #3          ; Quit
        BNE K1
        SEC
        RTS
K1      CMP #23         ; F3: a 区位 code
        BNE K2
        LDA #1
        STA QW
        LDA #0
        STA QWN
        BEQ KDONE
K2      CMP #12         ; F2: delete
        BNE K3
        JMP DELETE
K3      CMP #8
        BNE K4
        JMP LEFT
K4      CMP #21
        BNE K5
        JMP RIGHT
K5      CMP #11
        BNE K6
        JMP UP
K6      CMP #10
        BNE K7
        JMP DOWN
K7      CMP #13         ; Return: a new line
        BNE K8
        LDA #0
        STA GR
        LDA #13
        STA GP
        JMP INSERT
K8      CMP #32         ; a letter, a digit, a sign: its full-width one
        BCC KDONE
        BNE K9
        LDA #1          ; the space: 1-1
        STA GR
        STA GP
        JMP INSERT
K9      CMP #127
        BCS KDONE
        SEC
        SBC #32
        STA GP
        LDA #3
        STA GR
        JMP INSERT
KDONE   CLC
        RTS
; GR, GP into the text at the cursor
INSERT  LDA ENDP+1
        CMP #>LIMIT-1
        BCC ROOM
        LDA $C030       ; full: a click, no more
        CLC
        RTS
ROOM    LDA ENDP        ; everything from the cursor up two bytes, from the end down
        STA SRC
        LDA ENDP+1
        STA SRC+1
IMOVE   LDA SRC
        CMP CUR
        BNE IM1
        LDA SRC+1
        CMP CUR+1
        BEQ IPUT
IM1     LDA SRC
        BNE IM2
        DEC SRC+1
IM2     DEC SRC
        LDY #0
        LDA (SRC),Y
        LDY #2
        STA (SRC),Y
        JMP IMOVE
IPUT    LDY #0
        LDA GR
        STA (SRC),Y
        INY
        LDA GP
        STA (SRC),Y
        JSR ENDUP
        JSR CURUP
        LDA GR
        BEQ IDONE
        INC CHARS
        BNE IDONE
        INC CHARS+1
IDONE   CLC
        RTS
; the character before the cursor out
DELETE  LDA CUR
        CMP #<START
        BNE DEL1
        LDA CUR+1
        CMP #>START
        BEQ KDONE
DEL1    JSR CURDOWN
        LDA CUR
        STA DST
        LDA CUR+1
        STA DST+1
        LDY #0
        LDA (DST),Y
        BEQ DMOVE
        LDA CHARS
        BNE DM0
        DEC CHARS+1
DM0     DEC CHARS
DMOVE   LDA DST         ; everything after it down two bytes
        CLC
        ADC #2
        STA SRC
        LDA DST+1
        ADC #0
        STA SRC+1
DM1     LDA SRC
        CMP ENDP
        BNE DM2
        LDA SRC+1
        CMP ENDP+1
        BEQ DM3
DM2     LDY #0
        LDA (SRC),Y
        STA (DST),Y
        INC SRC
        BNE DM4
        INC SRC+1
DM4     INC DST
        BNE DM1
        INC DST+1
        BNE DM1
DM3     LDA ENDP
        SEC
        SBC #2
        STA ENDP
        BCS DM5
        DEC ENDP+1
DM5     CLC
        RTS
LEFT    LDA CUR
        CMP #<START
        BNE L1
        LDA CUR+1
        CMP #>START
        BEQ L2
L1      JSR CURDOWN
L2      CLC
        RTS
RIGHT   LDA CUR
        CMP ENDP
        BNE R1
        LDA CUR+1
        CMP ENDP+1
        BEQ R2
R1      JSR CURUP
R2      CLC
        RTS
; up a line: to the same column on the line above (scrolling if at the top)
UP      LDA CROW
        BNE U1
        LDA TOP
        CMP #<START
        BNE U0
        LDA TOP+1
        CMP #>START
        BEQ R2
U0      JSR PREVROW
        JSR LAYOUT
U1      LDX CROW
        DEX
        JMP TOROW
; down a line (scrolling if at the bottom), if there is one
DOWN    LDX CROW
        INX
        CPX #10
        BCC D1
        LDA ROWE+10     ; at the bottom: the screen moves up a line, if there is more
        BEQ D2
        LDA ROWST+2
        STA TOP
        LDA ROWST+3
        STA TOP+1
        JSR LAYOUT
        LDX CROW
        INX
D1      LDA ROWE,X
        BNE TOROW
D2      CLC
        RTS
; to line X of the screen, the cursor's column or the line's end
TOROW   TXA
        ASL A
        TAY
        LDA CCOL
        CMP ROWN,X
        BCC TR1
        LDA ROWN,X
        CMP #17         ; a full line: its last character, not past it
        BCC TR1
        LDA #16
TR1     ASL A
        CLC
        ADC ROWST,Y
        STA CUR
        LDA ROWST+1,Y
        ADC #0
        STA CUR+1
        CLC
        RTS
CURUP   LDA CUR
        CLC
        ADC #2
        STA CUR
        BCC CU1
        INC CUR+1
CU1     RTS
CURDOWN LDA CUR
        SEC
        SBC #2
        STA CUR
        BCS CD1
        DEC CUR+1
CD1     RTS
ENDUP   LDA ENDP
        CLC
        ADC #2
        STA ENDP
        BCC EU1
        INC ENDP+1
EU1     RTS
; TOP up one line of the screen: back to its paragraph's start, then forward
PREVROW LDA TOP
        STA SRC
        LDA TOP+1
        STA SRC+1
        JSR BACK2       ; the new line before TOP, or the character
PR1     LDA SRC
        CMP #<START
        BNE PR2
        LDA SRC+1
        CMP #>START
        BEQ PR4
PR2     JSR BACK2
        LDY #0
        LDA (SRC),Y
        BNE PR1
        JSR FWD2        ; just after a new line: the paragraph starts here
PR4     LDA SRC         ; forward a line at a time to the one before TOP
        STA DST
        LDA SRC+1
        STA DST+1
        JSR ROWEND
        LDA SRC+1
        CMP TOP+1
        BCC PR4
        BNE PR5
        LDA SRC
        CMP TOP
        BCC PR4
PR5     LDA DST
        STA TOP
        LDA DST+1
        STA TOP+1
        RTS
BACK2   LDA SRC
        SEC
        SBC #2
        STA SRC
        BCS B21
        DEC SRC+1
B21     RTS
FWD2    LDA SRC
        CLC
        ADC #2
        STA SRC
        BCC F21
        INC SRC+1
F21     RTS
; SRC on to the start of the next line of the screen: 17 characters, or past a new line
ROWEND  LDA #17
        STA CNT
RE1     LDA SRC
        CMP ENDP
        BNE RE2
        LDA SRC+1
        CMP ENDP+1
        BEQ RE3
RE2     LDY #0
        LDA (SRC),Y
        PHA
        JSR FWD2
        PLA
        BEQ RE3
        DEC CNT
        BNE RE1
RE3     RTS
; the screen: laid out (the cursor kept on it), drawn, the cursor, the status
SHOW    JSR LAYOUT
        LDA CROW
        CMP #$FF
        BNE SH2
        LDA CUR+1       ; off the screen: above, or below?
        CMP TOP+1
        BCC SH1
        BNE SHD
        LDA CUR
        CMP TOP
        BCC SH1
SHD     LDA ROWST+2
        STA TOP
        LDA ROWST+3
        STA TOP+1
        JMP SHOW
SH1     JSR PREVROW
        JMP SHOW
SH2     LDA #1
        STA DRAWING
        JSR LAYOUT
        LDA #0
        STA DRAWING
        JSR CURSOR
        JMP STATUS
DRAWING .byte 0
; walk the text from TOP: each line's start and length, the cursor's place; and
; while DRAWING, each cell drawn where it changed
LAYOUT  LDA TOP
        STA SRC
        LDA TOP+1
        STA SRC+1
        LDA #<SHADOW
        STA SHP
        LDA #>SHADOW
        STA SHP+1
        LDA #0
        STA EROW
        STA ECOL
        LDA #$FF
        STA CROW
        LDA #1
        STA LIVE
        LDX #0
LROW    LDA LIVE
        STA ROWE,X
        TXA
        ASL A
        TAY
        LDA SRC
        STA ROWST,Y
        LDA SRC+1
        STA ROWST+1,Y
        LDA #0
        STA WALK
LCELL   LDA CROW        ; the cursor here? (the first time only)
        CMP #$FF
        BNE LC1
        LDA SRC
        CMP CUR
        BNE LC1
        LDA SRC+1
        CMP CUR+1
        BNE LC1
        STX CROW
        LDA WALK
        STA CCOL
LC1     LDA SRC         ; the text's end: the rest empty, no more lines
        CMP ENDP
        BNE LC2
        LDA SRC+1
        CMP ENDP+1
        BNE LC2
        LDA #0
        STA LIVE
        BEQ LFILL
LC2     LDY #0
        LDA (SRC),Y
        STA GR
        INY
        LDA (SRC),Y
        STA GP
        JSR FWD2
        LDA GR
        BEQ LFILL       ; a new line: the rest of this line empty
        JSR EMIT
        INC WALK
        LDA WALK
        CMP #17
        BCC LCELL
        BCS LNEXT
LFILL   LDA WALK
        STA ROWN,X
LF1     LDA WALK
        CMP #17
        BCS LNEXT2
        LDA #0
        STA GR
        STA GP
        JSR EMIT
        INC WALK
        BNE LF1
LNEXT   LDA #17
        STA ROWN,X
LNEXT2  INX
        CPX #10
        BCS LDONE
        JMP LROW
LDONE
        TXA
        ASL A
        TAY
        LDA SRC
        STA ROWST,Y
        LDA SRC+1
        STA ROWST+1,Y
        LDA LIVE
        STA ROWE+10
        RTS
; the next cell: GR, GP; drawn if it is not what the cell shows
EMIT    LDA DRAWING
        BEQ EM3
        LDY #0
        LDA (SHP),Y
        CMP GR
        BNE EM1
        INY
        LDA (SHP),Y
        CMP GP
        BEQ EM2
EM1     LDY #0
        LDA GR
        STA (SHP),Y
        INY
        LDA GP
        STA (SHP),Y
        TXA
        PHA
        JSR CELL
        PLA
        TAX
EM2     LDA SHP
        CLC
        ADC #2
        STA SHP
        BCC EM3
        INC SHP+1
EM3     INC ECOL
        LDA ECOL
        CMP #17
        BCC EM4
        LDA #0
        STA ECOL
        INC EROW
EM4     RTS
; draw character GR, GP (0: nothing) in cell EROW, ECOL
CELL    LDA GR
        BNE CL1
        LDX #31         ; empty: no dots
        LDA #0
CL0     STA GLYPH,X
        DEX
        BPL CL0
        BMI CL2
CL1     LDX GR          ; its glyph's number: its row's first, then the place
        LDA GP
        SEC
        SBC #1
        CLC
        ADC GBASEL,X
        STA WIN
        LDA GBASEH,X
        ADC #0
        PHA
        AND #1          ; its place in the window: $4000 + 32 * (number mod 512)
        STA WIN+1
        LDY #5
CL3     ASL WIN
        ROL WIN+1
        DEY
        BNE CL3
        LDA WIN+1
        ORA #$40
        STA WIN+1
        PLA             ; the bank: the number over 512
        LSR A
        JSR FETCHAT
CL2     LDY EROW
        LDA ROWY,Y
        STA Y0
        LDX ECOL
        LDA COLB,X
        STA CB
        LDA COLS,X
        STA CS
        LDA #$FF        ; the cell's dots: 16 of them shifted into place
        STA V0
        STA V1
        JSR SHIFT
        LDA V0
        STA M0
        LDA V1
        STA M1
        LDA V2
        STA M2
        LDA V3
        STA M3
        LDA #0
        STA RR
CROWS   LDA RR
        ASL A
        TAX
        LDA GLYPH,X
        STA V0
        LDA GLYPH+1,X
        STA V1
        JSR SHIFT
        LDA Y0
        CLC
        ADC RR
        JSR PUTROW
        INC RR
        LDA RR
        CMP #16
        BCC CROWS
        RTS
; V0, V1 shifted CS dots on, then cut into four 7-dot bytes in V0-V3
SHIFT   LDA #0
        STA V2
        STA V3
        LDX CS
        BEQ SF2
SF1     ASL V0
        ROL V1
        ROL V2
        DEX
        BNE SF1
SF2     LDA V0          ; dots 0-6
        AND #$7F
        STA G0
        JSR LEFT1
        LDA V1          ; dots 7-13
        AND #$7F
        STA G1
        JSR LEFT1
        LDA V2          ; 14-20
        AND #$7F
        STA G2
        JSR LEFT1
        LDA V3          ; 21-27
        AND #$7F
        STA V3
        LDA G0
        STA V0
        LDA G1
        STA V1
        LDA G2
        STA V2
        RTS
LEFT1   ASL V0
        ROL V1
        ROL V2
        ROL V3
        RTS
; the dots V0-V3 into row A of the cell, its bytes CB on, where M0-M3 say
PUTROW  TAY
        LDA BASELO,Y
        CLC
        ADC CB
        STA PTR
        LDA BASEHI,Y
        ADC #0
        STA PTR+1
        LDY #0
PR6     TYA             ; not past the row's 40 bytes
        CLC
        ADC CB
        CMP #40
        BCS PR7
        LDA M0,Y
        EOR #$FF
        AND (PTR),Y
        ORA V0,Y
        AND #$7F
        STA (PTR),Y
        INY
        CPY #4
        BCC PR6
PR7     RTS
; the cursor: a line of 16 dots under its cell
CURSOR  LDA OLDCR
        CMP #$FF
        BEQ CU2
        STA EROW
        LDA OLDCC
        STA ECOL
        LDA #0
        JSR UNDERL
CU2     LDA CROW
        STA OLDCR
        STA EROW
        LDA CCOL
        CMP #17
        BCC CU3
        LDA #16
CU3     STA OLDCC
        STA ECOL
        LDA #$FF
UNDERL  STA TMP
        LDY EROW
        LDA ROWY,Y
        CLC
        ADC #16
        PHA
        LDX ECOL
        LDA COLB,X
        STA CB
        LDA COLS,X
        STA CS
        LDA #$FF
        STA V0
        STA V1
        JSR SHIFT
        LDX #3
UL1     LDA V0,X
        STA M0,X
        AND TMP
        STA V0,X
        DEX
        BPL UL1
        PLA
        JMP PUTROW
; the status line: 行 the line, 列 the column, 字 the characters (or 区 and the digits typed)
STATUS  LDA #<START     ; the cursor's line and column: count from the start
        STA SRC
        LDA #>START
        STA SRC+1
        LDA #1
        STA LINEL
        STA COLN
        LDA #0
        STA LINEH
ST1     LDA SRC
        CMP CUR
        BNE ST2
        LDA SRC+1
        CMP CUR+1
        BEQ ST4
ST2     LDY #0
        LDA (SRC),Y
        BNE ST3
        INC LINEL
        BNE ST2A
        INC LINEH
ST2A    LDA #0
        STA COLN
ST3     LDA COLN
        CMP #99
        BCS ST3A
        INC COLN
ST3A    JSR FWD2
        JMP ST1
ST4     LDA #10
        STA EROW
        LDA #0
        STA ECOL
        LDA #<SHADOW+340
        STA SHP
        LDA #>SHADOW+340
        STA SHP+1
        LDA #1
        STA DRAWING
        LDA #HANGR      ; 行 and three digits
        LDX #HANGP
        JSR EMITC
        LDA LINEL
        STA NUML
        LDA LINEH
        STA NUMH
        LDA #3
        JSR DIGITS
        JSR SPACE
        LDA #LIER       ; 列 and two
        LDX #LIEP
        JSR EMITC
        LDA COLN
        STA NUML
        LDA #0
        STA NUMH
        LDA #2
        JSR DIGITS
        JSR SPACE
        LDA QW
        BNE ST5
        LDA #ZIR        ; 字 and four
        LDX #ZIP
        JSR EMITC
        LDA CHARS
        STA NUML
        LDA CHARS+1
        STA NUMH
        LDA #4
        JSR DIGITS
        JMP ST7
ST5     LDA #QUR        ; 区 and the digits typed
        LDX #QUP
        JSR EMITC
        LDY #0
ST6     CPY QWN
        BCS ST6A
        LDA QWD,Y
        CLC
        ADC #16
        TAX
        LDA #3
        BNE ST6B
ST6A    LDA #3
        LDX #63         ; _ for one still to come
ST6B    STY TMP
        JSR EMITC
        LDY TMP
        INY
        CPY #4
        BCC ST6
ST7     JSR SPACE
        LDA ECOL
        BNE ST7
        LDA #0
        STA DRAWING
        RTS
SPACE   LDA #0
        TAX
EMITC   STA GR
        STX GP
        LDX #0
        JMP EMIT
; NUMH:NUML as A (2-4) digits, full width, blanks before; too big, all 9s
DIGITS  STA CNT
        TAX
        LDA NUML        ; above 10^A - 1: 10^A - 1
        CMP LIML-2,X
        LDA NUMH
        SBC LIMH-2,X
        BCC DG0
        LDA LIML-2,X
        STA NUML
        LDA LIMH-2,X
        STA NUMH
DG0     LDA #0
        STA SHOWN
        LDX CNT
        DEX
DG1     LDY #0          ; how many of this power of ten
DG2     LDA NUML
        SEC
        SBC TENL,X
        STA TL
        LDA NUMH
        SBC TENH,X
        BCC DG3
        STA NUMH
        LDA TL
        STA NUML
        INY
        BNE DG2
DG3     STX SAVEX
        TYA
        BNE DG4
        LDA SHOWN
        BNE DG4
        CPX #0          ; the last digit always
        BEQ DG4
        JSR SPACE
        JMP DG5
DG4     LDA #1
        STA SHOWN
        TYA
        CLC
        ADC #16
        TAX
        LDA #3
        JSR EMITC
DG5     LDX SAVEX
        DEX
        BPL DG1
        RTS
TENL    .byte 1, 10, 100, <1000
TENH    .byte 0, 0, 0, >1000
LIML    .byte 99, <999, <9999
LIMH    .byte 0, >999, >9999
; each dot row's first byte on page 2: $4000 + 1024*(Y AND 7) + 128*(Y/8 AND 7) + 40*(Y/64);
; each 区位 row's first glyph: rows 1-9 from 256, 94 a row; 16-87 from 1102 (10-15 are empty)
TABLES  LDY #191
TB1     TYA
        AND #7
        ASL A
        ASL A
        STA TMP
        TYA
        LSR A
        LSR A
        LSR A
        AND #7
        LSR A
        PHP
        CLC
        ADC TMP
        ADC #$40
        STA BASEHI,Y
        PLP
        LDA #0
        ROR A
        STA TMP
        TYA
        AND #$C0
        BEQ TB3
        CMP #$40
        BEQ TB2
        LDA #80
        BNE TB4
TB2     LDA #40
        BNE TB4
TB3     LDA #0
TB4     CLC
        ADC TMP
        STA BASELO,Y
        DEY
        CPY #255
        BNE TB1
        LDA #0          ; rows 0, 10-15: none
        STA GBASEL
        STA GBASEH
        LDA #<256
        LDX #>256
        LDY #1
TB5     CPY #10
        BNE TB6
        LDA #<1102
        LDX #>1102
        LDY #16
TB6     STA GBASEL,Y
        PHA
        TXA
        STA GBASEH,Y
        PLA
        CLC
        ADC #94
        BCC TB7
        INX
TB7     INY
        CPY #88
        BCC TB5
        RTS
; copied to $300 and run there: reads go to the font while RAMRD is on, the
; code at $6000 with them, so this runs where they do not
FETCH   STA $C0B0       ; the bank, colour off as the Chinese system has it
        STA $C003
        LDY #31
FE1     LDA (WIN),Y
        STA GLYPH,Y
        DEY
        BPL FE1
        STA $C002
        RTS
FETCHEND
${wpTables()}`,
    },
  },
];

/**
 * The word processor's small tables, as assembly: each of the 17 cells' first byte across and
 * its shift; each line's top row; and the 区位 of the status line's words.
 */
function wpTables() {
  const cols = Array.from({ length: 17 }, (_, c) => 16 * c);
  /** @param {string} label @param {number[]} bytes */
  const table = (label, bytes) => {
    const lines = [];
    for (let i = 0; i < bytes.length; i += 16) lines.push(`${i ? "        " : label.padEnd(8)}.byte ${bytes.slice(i, i + 16).join(", ")}`);
    return lines.join("\n");
  };
  /** @param {string} name @param {string} ch */
  const word = (name, ch) => {
    const q = /** @type {number} */ (quwei(ch));
    return `${name}R = ${Math.floor(q / 100)}\n${name}P = ${q % 100}`;
  };
  return [
    table("COLB", cols.map((x) => Math.floor(x / 7))),
    table("COLS", cols.map((x) => x % 7)),
    table("ROWY", Array.from({ length: 11 }, (_, r) => r * 17)),
    word("HANG", "行"),
    word("LIE", "列"),
    word("ZI", "字"),
    word("QU", "区"),
  ].join("\n");
}
