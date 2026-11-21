// SPDX-License-Identifier: Apache-2.0
//
// Games (design/v0.0.3.md, P1): in lo-res colour, played on the keys or the joystick (P2), in
// English, as Apple II games of the time. Each reads the joystick only if one is plugged in
// (a port with nothing in it reads 255 on both paddles), and the arrows otherwise.

/** @typedef {import("../sim/samples.js").Sample} Sample */

/** @type {Sample[]} */
export const GAMES = [
  {
    id: "snake",
    section: "games",
    mode: "western",
    text: `10 DIM X(400),Y(400):X=RND(-(PEEK(78)+256*PEEK(79)))
20 TEXT:HOME:PRINT "SNAKE":PRINT
30 PRINT "STEER WITH THE ARROWS OR THE JOYSTICK."
40 PRINT "EAT THE COINS: EACH BITE MAKES YOU"
50 PRINT "LONGER. DO NOT HIT THE WALL OR YOURSELF."
60 PRINT:PRINT "  YELLOW 1    ORANGE 2    PINK 5"
70 PRINT:PRINT "PRESS A KEY TO START";:GET A$
100 GR:POKE 34,20:HOME:J=PDL(0)<255 OR PDL(1)<255
110 COLOR=5:HLIN 0,39 AT 0:HLIN 0,39 AT 39:VLIN 0,39 AT 0:VLIN 0,39 AT 39
120 T=0:H=3:L=4:S=0:G=0:DX=1:DY=0:W=40:COLOR=12
130 FOR I=0 TO 3:X(I)=10+I:Y(I)=20:PLOT X(I),20:NEXT
140 GOSUB 500:GOSUB 600
200 K=PEEK(-16384):IF K>127 THEN POKE -16368,0:GOSUB 400
210 IF J THEN GOSUB 450
220 NX=X(H)+DX:NY=Y(H)+DY:C=SCRN(NX,NY)
230 IF C=5 OR C=12 THEN 700
240 IF C>0 THEN GOSUB 650
250 COLOR=12:PLOT X(H),Y(H):H=H+1:IF H>400 THEN H=0
260 X(H)=NX:Y(H)=NY:COLOR=15:PLOT NX,NY
270 IF G>0 THEN G=G-1:GOTO 300
280 COLOR=0:PLOT X(T),Y(T):T=T+1:IF T>400 THEN T=0
300 FOR D=1 TO W:NEXT:GOTO 200
390 REM THE ARROWS: 8 LEFT, 21 RIGHT, 11 UP, 10 DOWN
400 K=K-128:IF K=8 AND DX=0 THEN DX=-1:DY=0
410 IF K=21 AND DX=0 THEN DX=1:DY=0
420 IF K=11 AND DY=0 THEN DX=0:DY=-1
430 IF K=10 AND DY=0 THEN DX=0:DY=1
440 RETURN
450 P=PDL(0):IF DX=0 AND (P<60 OR P>196) THEN DX=SGN(P-128):DY=0:RETURN
460 P=PDL(1):IF DY=0 AND (P<60 OR P>196) THEN DY=SGN(P-128):DX=0
470 RETURN
500 CX=INT(RND(1)*38)+1:CY=INT(RND(1)*38)+1:IF SCRN(CX,CY) THEN 500
510 R=RND(1):CC=13:IF R>.6 THEN CC=9
520 IF R>.9 THEN CC=11
530 COLOR=CC:PLOT CX,CY:RETURN
600 VTAB 22:HTAB 1:PRINT "COINS ";S;"    LENGTH ";L;"   ";:RETURN
650 S=S+1:IF C=9 THEN S=S+1
660 IF C=11 THEN S=S+4
670 G=G+1:L=L+1:IF W>8 THEN W=W-2
680 GOSUB 500:GOSUB 600:RETURN
700 FOR I=1 TO 30:K=PEEK(-16336):NEXT
710 VTAB 23:HTAB 1:PRINT "CRASH! YOU GOT ";S;" COINS."
720 PRINT "PLAY AGAIN (Y/N)? ";:GET A$:IF A$="Y" THEN 100
730 TEXT:HOME`,
  },
  {
    id: "bricks",
    section: "games",
    mode: "western",
    text: `10 X=RND(-(PEEK(78)+256*PEEK(79)))
20 TEXT:HOME:PRINT "BRICKS":PRINT
30 PRINT "KEEP THE BALL UP WITH THE BAT: THE"
40 PRINT "ARROWS OR THE JOYSTICK MOVE IT."
50 PRINT:PRINT "A PINK BRICK TAKES 3 HITS, AN ORANGE 2,"
60 PRINT "A YELLOW 1. YOU HAVE THREE BALLS."
70 PRINT:PRINT "PRESS A KEY TO START";:GET A$
100 GR:POKE 34,20:HOME:J=PDL(0)<255 OR PDL(1)<255:S=0:N=3
110 COLOR=5:HLIN 0,39 AT 0:VLIN 0,39 AT 0:VLIN 0,39 AT 39
120 GOSUB 800:PX=17:GOSUB 600
130 BX=INT(RND(1)*30)+5:BY=24:DX=1-2*(RND(1)<.5):DY=1:GOSUB 650
140 FOR D=1 TO 400:NEXT
200 K=PEEK(-16384):IF K>127 THEN POKE -16368,0:K=K-128:M=-2*(K=8)+2*(K=21):IF M THEN GOSUB 610
210 IF J THEN P=PDL(0):M=-2*(P<60)+2*(P>196):IF M THEN GOSUB 610
220 NX=BX+DX:NY=BY+DY
230 IF NX<1 OR NX>38 THEN DX=-DX:NX=BX+DX
240 IF NY<1 THEN DY=1:NY=BY+1
250 C=SCRN(NX,NY):IF C=11 OR C=9 OR C=13 THEN GOSUB 700:GOTO 200
260 IF NY=37 AND DY>0 AND NX>=PX-1 AND NX<=PX+6 THEN DY=-1:DX=1-2*(NX<PX+3):FOR I=1 TO 2:K=PEEK(-16336):NEXT:GOTO 200
270 COLOR=0:PLOT BX,BY:BX=NX:BY=NY:IF BY>38 THEN 900
280 COLOR=15:PLOT BX,BY:FOR D=1 TO 12:NEXT:GOTO 200
590 REM THE BAT, SIX BLOCKS AT THE BOTTOM; M MOVES IT
600 COLOR=7:HLIN PX,PX+5 AT 38:RETURN
610 Q=PX+M:IF Q<1 THEN Q=1
620 IF Q>33 THEN Q=33
630 COLOR=0:HLIN PX,PX+5 AT 38:PX=Q:GOTO 600
650 VTAB 22:HTAB 1:PRINT "SCORE ";S;"    BALLS ";N;"   ";:RETURN
690 REM A BRICK HIT: PINK TO ORANGE TO YELLOW TO GONE
700 B=INT((NX-2)/4):E=13:IF C=11 THEN E=9
710 IF C=13 THEN E=0:BL=BL-1
720 COLOR=E:HLIN 2+B*4,4+B*4 AT NY:S=S+1:DY=-DY:K=PEEK(-16336)
730 GOSUB 650:IF BL=0 THEN GOSUB 800
740 RETURN
790 REM SIX ROWS OF NINE BRICKS
800 BL=54:FOR R=0 TO 5:C=11:IF R>1 THEN C=9
810 IF R>3 THEN C=13
820 COLOR=C:FOR B=0 TO 8:HLIN 2+B*4,4+B*4 AT 4+R:NEXT B,R:RETURN
900 N=N-1:GOSUB 650:IF N>0 THEN 130
910 VTAB 23:HTAB 1:PRINT "GAME OVER. SCORE ";S
920 PRINT "PLAY AGAIN (Y/N)? ";:GET A$:IF A$="Y" THEN 100
930 TEXT:HOME`,
  },
  {
    id: "minehunt",
    section: "games",
    mode: "western",
    text: `10 HIMEM:24576:A=24576
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 X=RND(-(PEEK(78)+256*PEEK(79))):MI=25088:ST=25280
40 TEXT:HOME:PRINT "MINE HUNT":PRINT
50 PRINT "TEN MINES LIE UNDER THE 81 GREEN SQUARES."
60 PRINT "OPEN EVERY OTHER SQUARE: THE PIPS ON AN"
70 PRINT "OPEN ONE COUNT THE MINES AROUND IT. FLAG"
80 PRINT "A SQUARE YOU THINK HIDES A MINE."
90 PRINT:PRINT "ARROWS OR JOYSTICK: MOVE"
100 PRINT "SPACE OR BUTTON 0: OPEN"
110 PRINT "F OR BUTTON 1: FLAG":PRINT:PRINT "PRESS A KEY TO START";:GET A$
120 GR:POKE 34,20:HOME:J=PDL(0)<255 OR PDL(1)<255:CALL 24576
130 CX=4:CY=4:F=0:L=0:B0=0:B1=0:C=15:GOSUB 550:GOSUB 600
200 K=PEEK(-16384):IF K<128 THEN 240
210 POKE -16368,0:K=K-128:DX=(K=21)-(K=8):DY=(K=10)-(K=11)
220 IF DX OR DY THEN GOSUB 560:GOTO 200
230 IF K=32 THEN GOSUB 300
235 IF K=70 THEN GOSUB 400
240 IF NOT J THEN 200
250 Q=PDL(0):DX=(Q>196)-(Q<60):Q=PDL(1):DY=(Q>196)-(Q<60):IF DX OR DY THEN GOSUB 560:FOR D=1 TO 150:NEXT
260 Q=PEEK(49249)>127:IF Q AND NOT B0 THEN GOSUB 300
270 B0=Q:Q=PEEK(49250)>127:IF Q AND NOT B1 THEN GOSUB 400
280 B1=Q:GOTO 200
290 REM OPEN: THE MINES LAID AT THE FIRST, NONE ROUND IT
300 IF NOT F THEN GOSUB 700
310 POKE 6,CX:POKE 7,CY:CALL 24582:IF PEEK(8) THEN 800
320 GOSUB 600:IF PEEK(25472)=71 THEN 850
330 RETURN
390 REM FLAG, OR TAKE A FLAG AWAY
400 I=ST+CY*9+CX:S=PEEK(I):IF S=1 THEN RETURN
410 POKE I,2-S:L=L+(S=0)-(S=2):POKE 6,CX:POKE 7,CY:CALL 24585:GOTO 600
549 REM THE CURSOR: A FRAME ROUND THE SQUARE, IN COLOUR C
550 U=2+4*CX:V=4*CY:COLOR=C:HLIN U,U+4 AT V:HLIN U,U+4 AT V+4:VLIN V,V+4 AT U:VLIN V,V+4 AT U+4:RETURN
560 IF CX+DX<0 OR CX+DX>8 OR CY+DY<0 OR CY+DY>8 THEN RETURN
570 C=0:GOSUB 550:CX=CX+DX:CY=CY+DY:C=15:GOTO 550
600 VTAB 22:HTAB 1:PRINT "MINES 10   FLAGS ";L;"   OPEN ";PEEK(25472);"/71  ";:RETURN
700 F=1:FOR I=1 TO 10
710 A=INT(RND(1)*9):B=INT(RND(1)*9):IF PEEK(MI+B*9+A) OR (ABS(A-CX)<2 AND ABS(B-CY)<2) THEN 710
720 POKE MI+B*9+A,1:NEXT:CALL 24579:RETURN
800 CALL 24588:FOR I=1 TO 60:Q=PEEK(-16336):NEXT
810 VTAB 23:HTAB 1:PRINT "BOOM! YOU OPENED A MINE.":GOTO 870
850 VTAB 23:HTAB 1:PRINT "ALL CLEAR! EVERY MINE FOUND."
870 PRINT "PLAY AGAIN (Y/N)? ";:GET A$:IF A$="Y" THEN 120
880 TEXT:HOME:END`,
    code: {
      org: 24576,
      line: 1000,
      source: `; Mine hunt's board, in machine code: BASIC would take seconds a square. The
; board is 9 x 9 squares, each 3 x 3 blocks of lo-res with a block between,
; square I = 9*Y+X. BASIC lays the mines, moves the cursor and keeps the rules;
; these draw the squares and open them, a field of empty ones at a time.
SETCOL = $F864      ; the ROM's COLOR=: A the colour
PLOT = $F800        ; the ROM's PLOT: A down, Y across
HLINE = $F819       ; the ROM's HLIN: A down, Y from, H2 to
H2 = $2C
XX = $06            ; a square, from BASIC
YY = $07
RESULT = $08        ; 1: a mine was opened
SQ = $19            ; the square being drawn or opened
SX = $1A
SY = $1B
LEFT = $1C          ; its blocks' top left corner
TOP = $1D
BITS = $1E          ; its pips, two bytes
HEAD = $EB
TAIL = $EC
K = $ED
NX = $EE
NY = $EF
MINE = $6200        ; 81 bytes: 1 a mine
COUNT = $6260       ; 81 bytes: the mines round each square
STATE = $62C0       ; 81 bytes: 0 green, 1 open, 2 flagged
QUEUE = $6320       ; the squares still to open
OPENED = $6380      ; how many are open
SHOWING = $6381     ; 1: the mines are shown
        * = $6000
        JMP INIT        ; 24576: a new board, all green
        JMP COUNTS      ; 24579: count every square's mines
        JMP OPEN        ; 24582: open square XX,YY
        JMP DRAWXY      ; 24585: draw square XX,YY
        JMP SHOW        ; 24588: show where the mines were
INIT    LDX #80
        LDA #0
CLEAR   STA MINE,X
        STA COUNT,X
        STA STATE,X
        DEX
        BPL CLEAR
        STA OPENED
        STA SHOWING
        JMP ALL
SHOW    LDA #1
        STA SHOWING
ALL     LDA #0          ; draw all 81
        STA SQ
ALLNEXT JSR DRAWSQ
        INC SQ
        LDA SQ
        CMP #81
        BCC ALLNEXT
        RTS
DRAWXY  LDA YY          ; SQ = 9*YY+XX
        ASL A
        ASL A
        ASL A
        CLC
        ADC YY
        ADC XX
        STA SQ
; draw square SQ: its colour by its state, then a flag's mark or its pips
DRAWSQ  LDA SQ
        JSR SPLIT
        LDA SX
        ASL A
        ASL A
        CLC
        ADC #3
        STA LEFT
        LDA SY
        ASL A
        ASL A
        CLC
        ADC #1
        STA TOP
        LDX SQ
        LDA SHOWING
        BEQ NOSHOW
        LDA MINE,X
        BEQ NOSHOW
        LDA #1          ; a mine: magenta
        BNE FILL
NOSHOW  LDY STATE,X
        LDA COLOURS,Y
FILL    JSR SETCOL
        LDX #2
ROWS    LDA LEFT
        CLC
        ADC #2
        STA H2
        TXA
        PHA
        CLC
        ADC TOP
        LDY LEFT
        JSR HLINE
        PLA
        TAX
        DEX
        BPL ROWS
        LDX SQ
        LDA STATE,X
        CMP #2
        BEQ FLAG
        CMP #1
        BNE DONE
        LDY COUNT,X
        BEQ DONE
        LDA PIPLO-1,Y
        STA BITS
        LDA PIPHI-1,Y
        STA BITS+1
        LDA #2          ; the pips dark blue
        JSR SETCOL
        LDX #0
PIP     LSR BITS+1
        ROR BITS
        BCC NOPIP
        TXA
        PHA
        LDA LEFT
        CLC
        ADC PIPX,X
        TAY
        LDA TOP
        CLC
        ADC PIPY,X
        JSR PLOT
        PLA
        TAX
NOPIP   INX
        CPX #9
        BCC PIP
DONE    RTS
FLAG    LDA #1          ; a flag: a magenta mark in the middle
        JSR SETCOL
        LDY LEFT
        INY
        LDX TOP
        INX
        TXA
        JMP PLOT
; SX, SY from a square's number in A
SPLIT   LDX #0
DIV     CMP #9
        BCC REM
        SBC #9
        INX
        BNE DIV
REM     STA SX
        STX SY
        RTS
; count the mines round every square
COUNTS  LDA #80
        STA SQ
CNEXT   LDA SQ
        JSR SPLIT
        LDA #0
        STA K
        LDY #7
CNB     JSR NEIGH
        BCS CSKIP
        LDA MINE,X
        CLC
        ADC K
        STA K
CSKIP   DEY
        BPL CNB
        LDX SQ
        LDA K
        STA COUNT,X
        DEC SQ
        BPL CNEXT
        RTS
; neighbour Y (0-7) of SX,SY: its number in X, or carry set if off the board
NEIGH   LDA SX
        CLC
        ADC DX,Y
        CMP #9
        BCS OFF
        STA NX
        LDA SY
        CLC
        ADC DY,Y
        CMP #9
        BCS OFF
        STA NY
        ASL A
        ASL A
        ASL A
        CLC
        ADC NY
        ADC NX
        TAX
        CLC
OFF     RTS
; open XX,YY: a mine says so; an empty square opens all the squares round it
OPEN    LDA #0
        STA RESULT
        JSR DRAWXY
        LDX SQ
        LDA STATE,X
        BNE ODONE
        LDA MINE,X
        BEQ SAFE
        LDA #1
        STA RESULT
ODONE   RTS
SAFE    LDA #1
        STA STATE,X
        TXA
        STA QUEUE
        LDA #0
        STA HEAD
        LDA #1
        STA TAIL
ONEXT   LDX HEAD
        CPX TAIL
        BCS ODONE
        LDA QUEUE,X
        STA SQ
        INC HEAD
        INC OPENED
        JSR DRAWSQ
        LDX SQ
        LDA COUNT,X
        BNE ONEXT
        LDA SQ
        JSR SPLIT
        LDY #7
ONB     JSR NEIGH
        BCS OSKIP
        LDA STATE,X
        BNE OSKIP
        LDA #1
        STA STATE,X
        TXA
        LDX TAIL
        STA QUEUE,X
        INC TAIL
OSKIP   DEY
        BPL ONB
        JMP ONEXT
COLOURS .byte 12, 10, 9         ; green, grey, orange
PIPLO   .byte 16, 1, 17, 69, 85, 109, 125, 239
PIPHI   .byte 0, 1, 1, 1, 1, 1, 1, 1
PIPX    .byte 0, 1, 2, 0, 1, 2, 0, 1, 2
PIPY    .byte 0, 0, 0, 1, 1, 1, 2, 2, 2
DX      .byte 255, 0, 1, 255, 1, 255, 0, 1
DY      .byte 255, 255, 255, 0, 0, 1, 1, 1`,
    },
  },
];
