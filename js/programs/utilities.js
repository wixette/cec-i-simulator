// SPDX-License-Identifier: Apache-2.0
//
// Utilities (design/v0.0.3.md, P1): a calendar for any month of any year, and a clock. Western
// BASIC, in English.

/** @typedef {import("../sim/samples.js").Sample} Sample */

/** @type {Sample[]} */
export const UTILITIES = [
  {
    id: "calendar",
    section: "utilities",
    mode: "western",
    text: `10 DIM M$(12),D(12):FOR I=1 TO 12:READ M$(I),D(I):NEXT
20 TEXT:HOME:PRINT "CALENDAR":PRINT
30 PRINT "ANY MONTH OF ANY YEAR FROM 1583, WHEN"
40 PRINT "THE CALENDAR WE USE NOW HAD BEGUN."
50 PRINT:INPUT "YEAR? ";Y:IF Y<1583 OR Y>9999 OR Y<>INT(Y) THEN PRINT "FROM 1583 TO 9999, PLEASE.":GOTO 50
60 INPUT "MONTH (1-12)? ";M:IF M<1 OR M>12 OR M<>INT(M) THEN 60
100 HOME:L=(Y/4=INT(Y/4) AND Y/100<>INT(Y/100)) OR Y/400=INT(Y/400):N=D(M)+(M=2 AND L)
110 A=M:B=Y:IF A<3 THEN A=A+12:B=B-1
120 K=B-INT(B/100)*100:J=INT(B/100)
130 W=1+INT(13*(A+1)/5)+K+INT(K/4)+INT(J/4)+5*J:W=W-INT(W/7)*7:W=W+6-INT((W+6)/7)*7
140 T$=M$(M)+" "+STR$(Y):VTAB 2:HTAB 21-INT(LEN(T$)/2):PRINT T$
150 VTAB 5:HTAB 3:PRINT "SUN  MON  TUE  WED  THU  FRI  SAT"
160 FOR I=1 TO N:P=W+I-1:R=INT(P/7):C=P-R*7
170 VTAB 7+R*2:HTAB 4+C*5-(I>9):IF C=0 THEN INVERSE
180 PRINT I;:NORMAL:NEXT
190 VTAB 21:HTAB 1:PRINT "LEFT, RIGHT ARROWS: MONTH BEFORE, AFTER"
200 PRINT "UP, DOWN ARROWS: YEAR BEFORE, AFTER"
210 PRINT "N: ANOTHER DATE      Q: STOP";
220 GET A$:K=ASC(A$)
230 IF K=8 THEN M=M-1:IF M<1 THEN M=12:Y=Y-1
240 IF K=21 THEN M=M+1:IF M>12 THEN M=1:Y=Y+1
250 IF K=11 THEN Y=Y-1
260 IF K=10 THEN Y=Y+1
270 IF A$="N" THEN 20
280 IF A$="Q" THEN HOME:END
290 IF Y<1583 THEN Y=1583
300 IF Y>9999 THEN Y=9999
310 GOTO 100
400 DATA JANUARY,31,FEBRUARY,28,MARCH,31,APRIL,30,MAY,31,JUNE,30
410 DATA JULY,31,AUGUST,31,SEPTEMBER,30,OCTOBER,31,NOVEMBER,30,DECEMBER,31`,
  },
  {
    id: "clock",
    section: "utilities",
    mode: "western",
    text: `10 HIMEM:24576:A=24576
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 TEXT:HOME:PRINT "CLOCK":PRINT
40 PRINT "THE COMPUTER HAS NO CLOCK OF ITS OWN:"
50 PRINT "SET IT, AND IT KEEPS THE TIME BY COUNTING"
60 PRINT "THE 50 PICTURES THE SCREEN SHOWS A SECOND."
70 PRINT:INPUT "THE TIME NOW: HOURS (1-12)? ";H:IF H<1 OR H>12 OR H<>INT(H) THEN 70
80 INPUT "MINUTES (0-59)? ";M:IF M<0 OR M>59 OR M<>INT(M) THEN 80
90 INPUT "SECONDS (0-59)? ";S:IF S<0 OR S>59 OR S<>INT(S) THEN 90
110 HGR:POKE 34,20:HOME:HCOLOR=3
120 FOR I=0 TO 59:Q=I*.10472:X=139+79*SIN(Q):Y=80-72*COS(Q):HPLOT X,Y:HPLOT X+1,Y
130 IF I/5=INT(I/5) THEN HPLOT 139+70*SIN(Q),80-64*COS(Q) TO X,Y:HPLOT 140+70*SIN(Q),80-64*COS(Q) TO X+1,Y
140 NEXT:HPLOT 138,79 TO 141,79:HPLOT 138,80 TO 141,80:HPLOT 138,81 TO 141,81
150 VTAB 22:PRINT "PRESS A KEY TO SET THE TIME, Q TO STOP.";
160 POKE 28416,H:POKE 28417,M:POKE 28418,S:CALL 24576
170 GET A$:IF A$="Q" THEN TEXT:HOME:END
180 GOTO 30`,
    code: {
      org: 24576,
      line: 1000,
      source: `; The clock's hands, and its time. The CEC-I has no clock and no interrupts: the
; time is kept by counting the fields the screen shows, 50 a second, as $C019's
; bit 7 goes from 0 (between pictures) to 1 (the picture). It is read between
; every two dots drawn, so that not one field is missed while the hands move.
; Each hand's 60 places are in the tables at the end, as how far its tip is
; across and down from the centre; each step of its line, a dot at most, is
; worked out from them.
PTR = $06           ; the byte row a dot is in
CLOCK = $6F00       ; hours, minutes, seconds (from BASIC)
HOURS = CLOCK
MINUTES = CLOCK+1
SECONDS = CLOCK+2
FIELDS = $6F03      ; fields counted towards the next second
PENDING = $6F04     ; seconds passed, not yet shown
LAST = $6F05        ; $C019 when last read
PX = $6F06          ; a dot to draw: across, down
PY = $6F07
MODE = $6F08        ; 0 erase white, 1 white, 2 erase orange, 3 orange
HAND = $6F09        ; the hand being drawn: 0 hour, 1 minute, 2 second
PLACE = $6F0A       ; and its place, 0-59
STEPS = $6F0B
XL = $6F0C          ; where the hand's line has got to, 8.8
XH = $6F0D
YL = $6F0E
YH = $6F0F
OLDS = $6F10
DIV7 = $6A00        ; each dot across: its byte in the row
MOD7 = $6B00        ; and its bit
BASELO = $6C00      ; each row's first byte
BASEHI = $6CC0
        * = $6000
        JSR SETUP
        LDA $C019
        AND #$80
        STA LAST
        LDA #0
        STA FIELDS
        STA PENDING
DRAW    LDA #1
        STA MODE
        JSR HANDS
WAIT    JSR TICK
        LDA $C000       ; a key: back to BASIC, which reads it
        BMI STOP
        LDA PENDING
        BEQ WAIT
        DEC PENDING
        LDA SECONDS     ; the second hand off, and on a new minute the others
        STA OLDS
        LDA #2
        STA HAND
        STA MODE
        JSR ONEHAND
        LDA #0
        STA MODE
        LDA OLDS
        CMP #59
        BNE TIME
        JSR TWO
TIME    INC SECONDS
        LDA SECONDS
        CMP #60
        BCC DRAW
        LDA #0
        STA SECONDS
        INC MINUTES
        LDA MINUTES
        CMP #60
        BCC DRAW
        LDA #0
        STA MINUTES
        INC HOURS
        LDA HOURS
        CMP #13
        BCC DRAW
        LDA #1
        STA HOURS
        JMP DRAW
STOP    RTS
; all three hands, in MODE (white for two; the second hand orange)
HANDS   JSR TWO
        LDA #2
        STA HAND
        LDA MODE
        ORA #2
        STA MODE
        JSR ONEHAND
        LDA MODE
        AND #1
        STA MODE
        RTS
TWO     LDA #0          ; the hour hand, then the minute hand
        STA HAND
        JSR ONEHAND
        LDA #1
        STA HAND
; one hand: its place from the time, then its line from the centre
ONEHAND LDA HAND
        BNE NOTHOUR
        LDA HOURS       ; the hour hand: 5 places an hour, one more each 12 minutes
        CMP #12
        BCC H1
        LDA #0
H1      STA PLACE
        ASL A
        ASL A
        CLC
        ADC PLACE
        STA PLACE
        LDA MINUTES
        LDX #0
H2      CMP #12
        BCC H3
        SBC #12
        INX
        BNE H2
H3      TXA
        CLC
        ADC PLACE
        TAY
        LDA #0
        BEQ LINE
NOTHOUR CMP #1
        BNE SECOND
        LDY MINUTES
        LDA #1
        BNE LINE
SECOND  LDY SECONDS
        LDA #2
; a hand's line: hand A (0-2), place Y; each step DX, DY in 256ths of a dot
LINE    TAX
        TYA
        CLC
        ADC HAND60,X    ; its entry: 60 * hand + place
        TAY
        LDA TIPX,Y
        STA DXH
        LDA TIPY,Y
        STA DYH
        LDA DXH         ; the steps: the longer of across and down, at least 1
        JSR ABS
        STA STEPS
        LDA DYH
        JSR ABS
        CMP STEPS
        BCC LONGER
        STA STEPS
LONGER  LDA STEPS
        BNE SOME
        INC STEPS
SOME    LDA DXH
        JSR PERSTEP
        STA DXL
        STX DXH
        LDA DYH
        JSR PERSTEP
        STA DYL
        STX DYH
        INC STEPS       ; the centre's dot too
        LDA #128        ; from the centre, 139,80, and half a dot
        STA XL
        STA YL
        LDA #139
        STA XH
        LDA #80
        STA YH
STEP    LDA XH
        STA PX
        LDA YH
        STA PY
        JSR PLOT
        JSR TICK
        CLC
        LDA XL
        ADC DXL
        STA XL
        LDA XH
        ADC DXH
        STA XH
        CLC
        LDA YL
        ADC DYL
        STA YL
        LDA YH
        ADC DYH
        STA YH
        DEC STEPS
        BNE STEP
        RTS
; A without its sign
ABS     CMP #$80
        BCC POS
        EOR #$FF
        ADC #0          ; the carry is set: +1
POS     RTS
; a distance A (-128 to 127) over STEPS: 256 * A / STEPS, low in A, high in X
PERSTEP STA SIGN
        JSR ABS
        STA NUMH
        LDA #0
        STA NUML
        STA QL
        STA QH
        STA REMV
        LDX #16
DLOOP   ASL NUML        ; one bit of the quotient at a time
        ROL NUMH
        ROL REMV
        LDA REMV
        CMP STEPS
        BCC DSKIP
        SBC STEPS
        STA REMV
DSKIP   ROL QL
        ROL QH
        DEX
        BNE DLOOP
        LDA SIGN        ; below 0: the quotient's negative
        BPL DPOS
        LDA #0
        SEC
        SBC QL
        STA QL
        LDA #0
        SBC QH
        STA QH
DPOS    LDA QL
        LDX QH
        RTS
SIGN    .byte 0
NUML    .byte 0
NUMH    .byte 0
QL      .byte 0
QH      .byte 0
REMV    .byte 0
HAND60  .byte 0, 60, 120
DXL     .byte 0
DXH     .byte 0
DYL     .byte 0
DYH     .byte 0
; a field passed? ($C019 from 0 to 1); 50 of them a second
TICK    LDA $C019
        AND #$80
        CMP LAST
        BEQ SAME
        STA LAST
        CMP #$80
        BNE SAME
        INC FIELDS
        LDA FIELDS
        CMP #50
        BCC SAME
        LDA #0
        STA FIELDS
        INC PENDING
SAME    RTS
; a dot at PX,PY: white is two dots side by side; orange one dot in an odd
; column of a byte with bit 7 set (one dot of colour shows only every other column)
PLOT    LDY PY
        LDA BASELO,Y
        STA PTR
        LDA BASEHI,Y
        STA PTR+1
        LDX PX
        LDA MODE
        CMP #2
        BCS ORANGE
        JSR DOT
        INX
DOT     LDY DIV7,X
        LDA MOD7,X
        STX SAVEX
        TAX
        LDA (PTR),Y
        LSR MODE
        BCC OFF
        ORA ONBIT,X
        BCS PUT
OFF     AND NOBIT,X
PUT     ROL MODE
        STA (PTR),Y
        LDX SAVEX
        RTS
ORANGE  TXA
        ORA #1
        TAX
        LDY DIV7,X
        LDA MOD7,X
        STX SAVEX
        TAX
        LDA (PTR),Y
        LSR MODE
        BCC OFF2
        ORA ONBIT,X
        ORA #$80
        BCS PUT2
OFF2    AND NOBIT,X
PUT2    ROL MODE
        STA (PTR),Y
        LDX SAVEX
        RTS
SAVEX   .byte 0
COL     .byte 0
BYTE    .byte 0
ONBIT   .byte 1, 2, 4, 8, 16, 32, 64
NOBIT   .byte 254, 253, 251, 247, 239, 223, 191
; the tables of where dots are: each column's byte and bit; each row's address,
; $2000 + 1024*(Y AND 7) + 128*(Y/8 AND 7) + 40*(Y/64)
SETUP   LDX #0
        STX COL
        STX BYTE
D7      LDA BYTE
        STA DIV7,X
        LDA COL
        STA MOD7,X
        INC COL
        LDA COL
        CMP #7
        BCC D7N
        LDA #0
        STA COL
        INC BYTE
D7N     INX
        BNE D7
        LDY #191
ROW     TYA
        AND #7
        ASL A
        ASL A
        STA PTR+1       ; 4 * (Y AND 7)
        TYA
        LSR A
        LSR A
        LSR A
        AND #7
        LSR A           ; (Y/8 AND 7) / 2, its last bit in the carry
        PHP
        CLC
        ADC PTR+1
        ADC #$20
        STA BASEHI,Y
        PLP
        LDA #0
        ROR A           ; 128 if that bit was 1
        STA PTR
        TYA
        AND #$C0        ; 40 * (Y/64)
        BEQ R2
        CMP #$40
        BEQ R1
        LDA #80
        BNE R3
R1      LDA #40
        BNE R3
R2      LDA #0
R3      CLC
        ADC PTR
        STA BASELO,Y
        DEY
        CPY #255
        BNE ROW
        RTS
; where each hand's tip is, across and down from the centre, at each of its 60
; places: the hour hand 34 dots long, the minute hand 52, the second hand 58, all short
; of the marks round the face (from 64 dots out), so that none is drawn over
; (a dot is narrower than it is high: across, 1.094 times as many)
TIPX    ${tips((r, a) => r * Math.sin(a) * 1.094)}
TIPY    ${tips((r, a) => -r * Math.cos(a))}`,
    },
  },
];

/**
 * The clock's hand tables, as assembly: for each hand (34, 52 and 58 dots long) and each of its
 * 60 places, one coordinate of its tip, rounded, as .byte lines of 20.
 * @param {(r: number, a: number) => number} f the coordinate from the length and the angle
 */
function tips(f) {
  /** @type {number[]} */
  const all = [];
  for (const r of [34, 52, 58]) for (let i = 0; i < 60; i++) all.push(Math.round(f(r, (i * Math.PI) / 30)));
  /** @type {string[]} */
  const lines = [];
  for (let i = 0; i < all.length; i += 20) lines.push(`.byte ${all.slice(i, i + 20).join(", ")}`);
  return lines.join("\n        ");
}
