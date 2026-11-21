// SPDX-License-Identifier: Apache-2.0
//
// Learn (design/v0.0.3.md, P1): each the program a lesson of v0.0.4 ends with. Western BASIC,
// in English, as the Apple II programs the machine also ran.

/** @typedef {import("../sim/samples.js").Sample} Sample */

/** @type {Sample[]} */
export const LEARN = [
  {
    id: "guess",
    section: "learn",
    mode: "western",
    text: `10 HOME:X=RND(-(PEEK(78)+256*PEEK(79)))
20 PRINT "GUESS MY NUMBER":PRINT
30 PRINT "I AM THINKING OF A NUMBER"
40 PRINT "FROM 1 TO 100. CAN YOU GUESS IT?"
50 N=INT(RND(1)*100)+1:T=0
60 PRINT:INPUT "YOUR GUESS? ";G
70 T=T+1
80 IF G<N THEN PRINT "TOO SMALL.":GOTO 60
90 IF G>N THEN PRINT "TOO BIG.":GOTO 60
100 PRINT:PRINT "YES, IT IS ";N;"!"
110 PRINT "YOU GOT IT IN ";T;" GUESSES."
120 PRINT:INPUT "PLAY AGAIN (Y/N)? ";A$
130 IF LEFT$(A$,1)="Y" THEN 10`,
  },
  {
    id: "barchart",
    section: "learn",
    mode: "western",
    text: `10 TEXT:HOME:PRINT "BAR CHART":PRINT
20 PRINT "UP TO 8 BARS: FOR EACH, A SHORT NAME"
30 PRINT "AND A NUMBER. AN EMPTY NAME DRAWS THEM."
40 DIM L$(8),V(8):N=0:M=0
50 N=N+1:PRINT:PRINT "BAR ";N;" NAME? ";:INPUT "";L$(N)
60 IF L$(N)="" THEN N=N-1:GOTO 100
70 INPUT "   NUMBER? ";V(N):IF V(N)<0 THEN PRINT "   NOT BELOW 0, PLEASE.":GOTO 70
80 IF V(N)>M THEN M=V(N)
90 IF N<8 THEN 50
100 IF N=0 THEN END
110 IF M=0 THEN M=1
120 GR:HOME:W=INT(38/N):B=W-1:IF B>8 THEN B=8
130 COLOR=5:HLIN 0,39 AT 39
140 FOR I=1 TO N:READ C:H=INT(V(I)/M*37+.5):X=1+(I-1)*W
150 COLOR=C:IF H>0 THEN FOR Y=38 TO 39-H STEP -1:HLIN X,X+B-1 AT Y:NEXT
160 VTAB 21:HTAB X+1:PRINT LEFT$(L$(I),B);
170 VTAB 22:HTAB X+1:PRINT LEFT$(STR$(V(I)),B);
180 NEXT I
190 VTAB 24:HTAB 1:PRINT "PRESS A KEY FOR A NEW CHART";:GET A$
200 RESTORE:CLEAR:GOTO 10
210 DATA 13,9,12,6,11,14,1,7`,
  },
  {
    id: "curves",
    section: "learn",
    mode: "western",
    text: `10 HGR:POKE 34,20:HOME:PI=3.14159
20 PRINT "SINE WAVES: Y=SIN(X), SIN(2X), SIN(3X)"
30 HCOLOR=3:HPLOT 0,80 TO 279,80:HPLOT 138,5 TO 138,155:HPLOT 139,5 TO 139,155
40 FOR K=1 TO 3:READ C:HCOLOR=C:PX=-1
50 FOR X=0 TO 276 STEP 4:Y=80-70*SIN(K*(X-138)/276*4*PI):GOSUB 200:NEXT X,K
60 GOSUB 300
70 FOR L=1 TO 4:READ P,Q,C:HGR:POKE 34,20:HOME
80 PRINT "LISSAJOUS: X=SIN(";P;"T), Y=SIN(";Q;"T)"
90 HCOLOR=C:PX=-1:FOR T=0 TO 2*PI+.05 STEP .05
100 X=138+124*SIN(P*T):Y=80+75*SIN(Q*T+PI/4):GOSUB 200:NEXT T
110 GOSUB 300:NEXT L
120 RESTORE:GOTO 10
180 REM POKE 34,20: THE TEXT WINDOW, THE FOUR LINES UNDER THE PICTURE
190 REM A LINE TWO DOTS WIDE: ONE DOT OF COLOUR SHOWS ONLY IN EVERY OTHER COLUMN
200 IF PX>=0 THEN HPLOT PX,PY TO X,Y:HPLOT PX+1,PY TO X+1,Y
210 PX=X:PY=Y:RETURN
300 VTAB 24:PRINT "PRESS A KEY";:GET A$:RETURN
400 DATA 1,5,6
410 DATA 1,2,3,3,2,5,3,4,6,5,4,1`,
  },
  {
    id: "bigchar",
    section: "learn",
    mode: "western",
    text: `10 A=768
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 TEXT:HOME:PRINT "BIG CHARACTER":PRINT
40 PRINT "EVERY CHINESE CHARACTER IS 16 X 16 DOTS,"
50 PRINT "32 BYTES IN THE FONT CHIPS. GIVE ITS"
60 PRINT "QUWEI CODE (E.G. 5448 OR 2790) AND"
70 PRINT "SEE ITS DOTS LARGE."
80 PRINT:INPUT "QUWEI CODE? ";Q
90 R=INT(Q/100):P=Q-R*100
100 IF R<16 OR R>87 OR P<1 OR P>94 THEN PRINT "ROWS 16 TO 87, PLACES 1 TO 94.":GOTO 80
110 D=(R-16)*94+P-1+1102:B=INT(D/512):W=16384+(D-B*512)*32
120 POKE 6,B:POKE 7,W-INT(W/256)*256:POKE 8,INT(W/256):CALL 768
130 HGR:POKE 34,20:HOME:HCOLOR=3
140 FOR Y=0 TO 15:FOR H=0 TO 1:V=PEEK(832+2*Y+H)
150 FOR X=0 TO 7:IF V-INT(V/2)*2 THEN GOSUB 300
160 V=INT(V/2):NEXT X,H,Y
170 PRINT "QUWEI ";Q;": GLYPH ";D;", BANK ";B
180 PRINT "LATCH $C0B0 = ";B+16;", WINDOW ADDRESS ";W
190 VTAB 24:PRINT "PRESS A KEY FOR ANOTHER";:GET A$:GOTO 30
290 REM ONE DOT: A BLOCK 9 WIDE, 8 HIGH
300 C=68+(H*8+X)*9:R=8+Y*9
310 FOR K=0 TO 7:HPLOT C,R+K TO C+8,R+K:NEXT K:RETURN`,
    code: {
      org: 768,
      line: 1000,
      source: `; Copies a character's 32 bytes out of the font: the latch U32 at $C0B0 picks
; which 16 KB of the 256 KB font shows through the window at aux $4000-$7FFF; reads
; there go to the window while RAMRD ($C003) is on. BASIC cannot do this itself:
; its program and variables are in the same addresses of main memory.
BANK = $06          ; the bank, 0-15
WINDOW = $07        ; and the character's address in the window
DEST = $340         ; where its 32 bytes go, for BASIC to PEEK
        * = $300
        LDA BANK
        ORA #$10        ; colour stays on, as Western BASIC has it
        STA $C0B0       ; the bank into the window
        STA $C003       ; RAMRD on: $4000-$BFFF read from the aux side
        LDY #31
COPY    LDA (WINDOW),Y  ; from the font
        STA DEST,Y      ; to main memory: writes are not switched
        DEY
        BPL COPY
        STA $C002       ; RAMRD off: BASIC's memory again
        RTS`,
    },
  },
  {
    id: "versus",
    section: "learn",
    mode: "western",
    text: `10 A=768
20 READ B:IF B>=0 THEN POKE A,B:A=A+1:GOTO 20
30 GR:POKE 34,20:HOME
40 PRINT "ONE PICTURE, DRAWN TWICE."
50 PRINT "ON THE LEFT, BY BASIC ..."
60 FOR Y=0 TO 39:FOR X=0 TO 19
70 C=INT((ABS(2*X-19)+ABS(2*Y-39))/4):C=C-INT(C/15)*15+1
80 COLOR=C:PLOT X,Y:NEXT X,Y
90 PRINT "ON THE RIGHT, BY MACHINE CODE."
100 CALL 768
120 VTAB 24:HTAB 1:PRINT "PRESS A KEY TO DRAW THEM AGAIN";:GET A$:GOTO 30`,
    code: {
      org: 768,
      line: 1000,
      source: `; The picture of lines 60-80, worked out and drawn in machine code: the same
; sum for each block's colour, and the same PLOT routine in the ROM that BASIC's
; PLOT calls. All the difference is BASIC reading its line again for each block.
XX = $06            ; the block across, 0-19
YY = $07            ; and down, 0-39
T = $08
SETCOL = $F864      ; the ROM's COLOR=: A is the colour
PLOT = $F800        ; the ROM's PLOT: A down, Y across
        * = $300
        LDA #0
        STA YY
ROW     LDA #0
        STA XX
CELL    LDA XX          ; ABS(2*X-19)
        ASL A
        SEC
        SBC #19
        BCS DX
        EOR #$FF        ; below 0: its negative
        ADC #1
DX      STA T
        LDA YY          ; ABS(2*Y-39)
        ASL A
        SEC
        SBC #39
        BCS DY
        EOR #$FF
        ADC #1
DY      CLC
        ADC T
        LSR A           ; /4
        LSR A
MOD     CMP #15         ; what is left over from 15s
        BCC ONE
        SBC #15
        BCS MOD
ONE     CLC
        ADC #1          ; colours 1-15
        JSR SETCOL
        LDA XX
        CLC
        ADC #20         ; on the right half
        TAY
        LDA YY
        JSR PLOT
        INC XX
        LDA XX
        CMP #20
        BCC CELL
        INC YY
        LDA YY
        CMP #40
        BCC ROW
        RTS`,
    },
  },
];
