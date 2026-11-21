// SPDX-License-Identifier: Apache-2.0
//
// Chinese (design/v0.0.3.md, P1): programs in the Chinese system, their text in Chinese. A
// Chinese character in a BASIC string is three bytes, 127 and two more (js/sim/chinese.js), so
// LEN and MID$ count three to a character; typed in, each goes in through 区位, as Type in does.

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
    id: "numread",
    section: "chinese",
    mode: "chinese",
    text: `10 N$="零一二三四五六七八九":U$="十百千"
20 HOME:PRINT "数字读法":PRINT
30 PRINT "输入一个数，看它用汉字怎么读。"
40 PRINT "只用数字和小数点：整数最多十二位，"
50 PRINT "小数最多八位。例如 12345、123.45。"
60 PRINT "什么也不输入就结束。"
100 PRINT:INPUT "数：";A$
110 IF A$="" THEN HOME:END
120 GOSUB 500:IF E$<>"" THEN PRINT E$:GOTO 100
130 GOSUB 600:PRINT R$:GOTO 100
490 REM THE NUMBER: DIGITS BEFORE THE POINT IN I$, AFTER IT IN F$, OR WHAT IS WRONG IN E$
500 E$="":I$="":F$="":D=0
510 FOR K=1 TO LEN(A$):C$=MID$(A$,K,1)
520 IF C$="." THEN D=D+1:GOTO 550
530 IF C$<"0" OR C$>"9" THEN E$="只能用数字和小数点。":RETURN
540 IF D THEN F$=F$+C$:GOTO 550
545 I$=I$+C$
550 NEXT
560 IF D>1 THEN E$="小数点只能有一个。":RETURN
570 IF D AND F$="" THEN E$="小数点后面要有数字。":RETURN
580 IF LEN(I$)>1 AND LEFT$(I$,1)="0" THEN I$=MID$(I$,2):GOTO 580
590 IF I$="" THEN I$="0"
592 IF LEN(I$)>12 THEN E$="整数最多十二位。":RETURN
594 IF LEN(F$)>8 THEN E$="小数最多八位。":RETURN
596 RETURN
599 REM READ IT: A DIGIT AND ITS PLACE (十 百 千) FROM THE LEFT; 万 AND 亿 AFTER THEIR GROUPS;
600 REM ONE 零 FOR ZEROS BETWEEN DIGITS; 一十 AT THE START IS 十
605 R$="":Z=0:L=LEN(I$):IF I$="0" THEN R$="零":GOTO 700
610 FOR K=1 TO L:G=ASC(MID$(I$,K,1))-48:P=L-K:Q=P-INT(P/4)*4
620 IF G=0 THEN IF R$<>"" THEN Z=1
630 IF G THEN IF Z THEN R$=R$+"零":Z=0
640 IF G THEN R$=R$+MID$(N$,G*3+1,3):IF Q THEN R$=R$+MID$(U$,Q*3-2,3)
650 IF Q=0 AND P>0 THEN GOSUB 680
660 NEXT
670 IF LEFT$(R$,6)="一十" THEN R$=MID$(R$,4)
675 GOTO 700
680 B=K-3:IF B<1 THEN B=1
685 IF VAL(MID$(I$,B,K-B+1)) THEN R$=R$+MID$("万亿",(P/4)*3-2,3):Z=0
690 RETURN
700 IF F$="" THEN RETURN
710 R$=R$+"点":FOR K=1 TO LEN(F$):G=ASC(MID$(F$,K,1))-48:R$=R$+MID$(N$,G*3+1,3):NEXT:RETURN`,
  },
];
