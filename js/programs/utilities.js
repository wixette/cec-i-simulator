// SPDX-License-Identifier: Apache-2.0
//
// Utilities (design/v0.0.3.md, P1): a calendar for any month of any year, a clock, and a text
// editor. Western BASIC, in English.

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
  {
    id: "editor",
    section: "utilities",
    mode: "western",
    text: `10 HIMEM:24576:A=24576
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 D$=CHR$(4):DK=PEEK(976)=76 AND PEEK(978)=157:T=0
40 TEXT:HOME:PRINT "TEXT EDITOR":PRINT
50 PRINT "A WHOLE SCREEN OF TEXT, EDITED ANYWHERE."
60 PRINT:PRINT "ARROWS: MOVE THE CURSOR"
70 PRINT "F2: DELETE THE CHARACTER BEFORE IT"
80 PRINT "RETURN: A NEW LINE"
90 PRINT "QUIT: STOP"
100 PRINT:PRINT "N: A NEW TEXT":IF DK THEN PRINT "L: LOAD A TEXT FROM THE DISK"
110 IF NOT DK THEN PRINT:PRINT "TO SAVE TEXTS ON A DISK, START DOS 3.3":PRINT "FROM A DISK FIRST."
120 GET A$:IF A$="N" THEN T=1:HOME:CALL 24576:GOTO 200
130 IF DK AND A$="L" THEN 500
140 GOTO 120
200 HOME:PRINT "E: EDIT THE SAME TEXT AGAIN":IF DK THEN PRINT "S: SAVE IT ON THE DISK":PRINT "L: LOAD A TEXT FROM THE DISK"
210 PRINT "Q: QUIT"
220 GET A$:IF A$="E" THEN HOME:CALL 24579:GOTO 200
230 IF DK AND A$="S" THEN 400
240 IF DK AND A$="L" THEN 500
250 IF A$="Q" THEN HOME:END
260 GOTO 220
400 PRINT:INPUT "SAVE AS: ";N$:IF N$="" THEN 200
410 L=PEEK(26116)+256*PEEK(26117)-26112:ONERR GOTO 600
420 PRINT D$;"BSAVE ";N$;",A26112,L";L
430 POKE 216,0:PRINT "SAVED ON THE DISK AS ";N$:GOTO 650
500 PRINT:INPUT "LOAD: ";N$:IF N$="" THEN 690
510 ONERR GOTO 600
520 PRINT D$;"BLOAD ";N$;",A26112"
530 POKE 216,0:X=PEEK(26116)+256*PEEK(26117):IF X<26624 OR X>38400 THEN T=0:PRINT "THAT IS NOT A TEXT OF THIS EDITOR.":GOTO 650
540 T=1:HOME:CALL 24579:GOTO 200
600 POKE 216,0:E=PEEK(222):PRINT:IF E=6 THEN PRINT "NO FILE OF THAT NAME ON THE DISK.":GOTO 650
610 IF E=4 THEN PRINT "THE DISK IS WRITE PROTECTED.":GOTO 650
620 IF E=8 THEN PRINT "THE DISK CANNOT BE READ. IS IT FORMATTED":PRINT "(INIT)?":GOTO 650
630 IF E=9 THEN PRINT "THE DISK IS FULL.":GOTO 650
640 PRINT "THE DISK SAID: ERROR ";E
650 PRINT "PRESS A KEY";:GET A$
690 IF T THEN 200
700 GOTO 40`,
    code: {
      org: 24576,
      line: 1000,
      source: `; The text editor: a whole screen of text, edited anywhere, in the manner of
; WordStar; in machine code, so that every key shows at once. 23 lines of 40
; on the text screen, a line of status under them, the cursor in inverse. The
; text is a byte a character, a new line 13. Keys: the arrows; F2 deletes the
; character before the cursor; Return a new line; Quit ends.
PTR = $06           ; a line of the screen
SRC = $08           ; for walking and moving the text
DST = $1A
START = $6800       ; the text, up to $9600 (BASIC's HIMEM)
LIMIT = $9600
COLS = 40
ROWS = 23
CUR = $6600         ; the cursor's place in the text
TOP = $6602         ; the text at the top of the screen
ENDP = $6604        ; the text's end
CHARS = $6606       ; how many characters (not counting new lines)
ROWST = $6608       ; where each of the 23 lines starts, and the 24th (48 bytes)
ROWN = $6640        ; how many characters each line shows (23)
ROWE = $6660        ; 1 for each line with text, or room for it (24)
CROW = $6680        ; the cursor on the screen
CCOL = $6681
WALK = $6682
LIVE = $6683
CNT = $6684
SAVEZP = $6685      ; the zero page borrowed, 6 bytes
NUML = $668B
NUMH = $668C
LINEL = $668D
LINEH = $668E
COLL = $668F
COLH = $6690
TL = $6691
SHOWN = $6692
SAVEX = $6693
CH = $6694
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
AGAIN   LDX #1          ; borrow the zero page
SAVE1   LDA PTR,X
        STA SAVEZP,X
        LDA SRC,X
        STA SAVEZP+2,X
        LDA DST,X
        STA SAVEZP+4,X
        DEX
        BPL SAVE1
LOOP    JSR SHOW
KEY     LDA $C000
        BPL KEY
        STA $C010
        AND #$7F
        JSR DOKEY
        BCC LOOP
        LDX #1          ; Quit: the zero page back, and to BASIC
REST1   LDA SAVEZP,X
        STA PTR,X
        LDA SAVEZP+2,X
        STA SRC,X
        LDA SAVEZP+4,X
        STA DST,X
        DEX
        BPL REST1
        RTS
; a key: carry set to quit
DOKEY   CMP #3          ; Quit
        BNE K2
        SEC
        RTS
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
K7      CMP #13         ; Return, and every character that prints
        BEQ INSERT
        CMP #32
        BCC KDONE
        CMP #127
        BCC INSERT
KDONE   CLC
        RTS
; A into the text at the cursor
INSERT  STA CH
        LDA ENDP+1
        CMP #>LIMIT-1
        BCC ROOM
        LDA $C030       ; full: a click, no more
        CLC
        RTS
ROOM    LDA ENDP        ; everything from the cursor up a byte, from the end down
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
        INY
        STA (SRC),Y
        JMP IMOVE
IPUT    LDY #0
        LDA CH
        STA (SRC),Y
        INC ENDP
        BNE IP1
        INC ENDP+1
IP1     JSR CURUP
        LDA CH
        CMP #13
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
        CMP #13
        BEQ DMOVE
        LDA CHARS
        BNE DM0
        DEC CHARS+1
DM0     DEC CHARS
DMOVE   LDA DST         ; everything after it down a byte
        CLC
        ADC #1
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
        BNE DM5
        DEC ENDP+1
DM5     DEC ENDP
        CLC
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
; up a line: the same column on the line above (scrolling if at the top)
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
        CPX #ROWS
        BCC D1
        LDA ROWE+ROWS   ; at the bottom: the screen moves up a line, if there is more
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
        CMP #COLS       ; a full line: its last character, not past it
        BCC TR1
        LDA #COLS-1
TR1     CLC
        ADC ROWST,Y
        STA CUR
        LDA ROWST+1,Y
        ADC #0
        STA CUR+1
        CLC
        RTS
CURUP   INC CUR
        BNE CU1
        INC CUR+1
CU1     RTS
CURDOWN LDA CUR
        BNE CD1
        DEC CUR+1
CD1     DEC CUR
        RTS
FWD1    INC SRC
        BNE F11
        INC SRC+1
F11     RTS
BACK1   LDA SRC
        BNE B11
        DEC SRC+1
B11     DEC SRC
        RTS
; TOP up one line of the screen: back to its paragraph's start, then forward
PREVROW LDA TOP
        STA SRC
        LDA TOP+1
        STA SRC+1
        JSR BACK1       ; the character before TOP, perhaps its paragraph's new line
PR1     LDA SRC
        CMP #<START
        BNE PR2
        LDA SRC+1
        CMP #>START
        BEQ PR4
PR2     JSR BACK1
        LDY #0
        LDA (SRC),Y
        CMP #13
        BNE PR1
        JSR FWD1        ; just after a new line: the paragraph starts here
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
; SRC on to the next line's start: 40 characters, or past a new line
ROWEND  LDA #COLS
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
        JSR FWD1
        PLA
        CMP #13
        BEQ RE3
        DEC CNT
        BNE RE1
RE3     RTS
; the screen: the cursor kept on it, the text, the cursor, the status
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
SH2     LDY CROW        ; the cursor: its cell in inverse
        LDA LINELO,Y
        STA PTR
        LDA LINEHI,Y
        STA PTR+1
        LDY CCOL
        LDA (PTR),Y
        CMP #$E0
        BCC SH3
        AND #$1F        ; a small letter: the capital's inverse
        BPL SH4
SH3     AND #$3F
SH4     STA (PTR),Y
        JMP STATUS
; walk the text from TOP, writing it on the screen: each line's start and
; length, whether it has text, the cursor's place
LAYOUT  LDA TOP
        STA SRC
        LDA TOP+1
        STA SRC+1
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
        LDA LINELO,X
        STA PTR
        LDA LINEHI,X
        STA PTR+1
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
        JSR FWD1
        CMP #13
        BEQ LFILL       ; a new line: the rest of this line empty
        ORA #$80
        LDY WALK
        STA (PTR),Y
        INC WALK
        LDA WALK
        CMP #COLS
        BCC LCELL
        STA ROWN,X
        BCS LNEXT
LFILL   LDA WALK
        STA ROWN,X
        LDY WALK
        LDA #$A0
LF1     CPY #COLS
        BCS LNEXT
        STA (PTR),Y
        INY
        BNE LF1
LNEXT   INX
        CPX #ROWS
        BCS LDONE
        JMP LROW
LDONE   TXA
        ASL A
        TAY
        LDA SRC
        STA ROWST,Y
        LDA SRC+1
        STA ROWST+1,Y
        LDA LIVE
        STA ROWE,X
        RTS
; the status line, in inverse: LINE, COL, CHARS, and the keys
STATUS  LDA #<START     ; the cursor's line and column: counted from the start
        STA SRC
        LDA #>START
        STA SRC+1
        LDA #1
        STA LINEL
        STA COLL
        LDA #0
        STA LINEH
        STA COLH
ST1     LDA SRC
        CMP CUR
        BNE ST2
        LDA SRC+1
        CMP CUR+1
        BEQ ST4
ST2     LDY #0
        LDA (SRC),Y
        CMP #13
        BNE ST3
        INC LINEL
        BNE ST2A
        INC LINEH
ST2A    LDA #0
        STA COLL
        STA COLH
ST3     INC COLL
        BNE ST3A
        INC COLH
ST3A    JSR FWD1
        JMP ST1
ST4     LDA LINELO+23
        STA PTR
        LDA LINEHI+23
        STA PTR+1
        LDY #39         ; the line blank, in inverse
        LDA #$20
ST5     STA (PTR),Y
        DEY
        BPL ST5
        LDY #0
        LDX #0
        JSR WORD        ; LINE
        LDA LINEL
        STA NUML
        LDA LINEH
        STA NUMH
        JSR NUMBER
        INY
        JSR WORD        ; COL
        LDA COLL
        STA NUML
        LDA COLH
        STA NUMH
        JSR NUMBER
        INY
        JSR WORD        ; CHARS
        LDA CHARS
        STA NUML
        LDA CHARS+1
        STA NUMH
        JSR NUMBER
        LDY #24
        JMP WORD        ; F2 DEL QUIT
; the words of WORDS from X, up to a 0, at Y on the status line
WORD    LDA WORDS,X
        INX
        CMP #0
        BEQ WD1
        AND #$3F
        STA (PTR),Y
        INY
        BNE WORD
WD1     RTS
WORDS   .byte "LINE ", 0, "COL ", 0, "CHARS ", 0, "F2 DEL  QUIT ENDS", 0
; NUMH:NUML at Y, its digits without the zeros before them
NUMBER  LDA #0
        STA SHOWN
        STX SAVEX
        LDX #4
NB1     LDA #0          ; how many of this power of ten
        STA CH
NB2     LDA NUML
        SEC
        SBC TENL,X
        STA TL
        LDA NUMH
        SBC TENH,X
        BCC NB3
        STA NUMH
        LDA TL
        STA NUML
        INC CH
        BNE NB2
NB3     LDA CH
        BNE NB4
        LDA SHOWN
        BNE NB4
        CPX #0          ; the last digit always
        BNE NB5
NB4     LDA #1
        STA SHOWN
        LDA CH
        ORA #$30
        STA (PTR),Y
        INY
NB5     DEX
        BPL NB1
        LDX SAVEX
        RTS
TENL    .byte 1, 10, 100, <1000, <10000
TENH    .byte 0, 0, 0, >1000, >10000
; each line of the text screen's first byte
LINELO  ${textLines((a) => a & 255)}
LINEHI  ${textLines((a) => a >> 8)}`,
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

/**
 * The text screen's 24 lines' first bytes ($400 + 128 * (line mod 8) + 40 * (line / 8)), one byte
 * of each, as assembly.
 * @param {(addr: number) => number} f
 */
function textLines(f) {
  return `.byte ${Array.from({ length: 24 }, (_, l) => f(0x400 + 128 * (l % 8) + 40 * Math.floor(l / 8))).join(", ")}`;
}
