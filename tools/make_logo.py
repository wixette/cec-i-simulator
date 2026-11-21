# SPDX-License-Identifier: Apache-2.0
#
# Writes images/logo.svg and images/favicon.svg: the CEC-I from above, drawn low poly; the
# favicon simplified to read at 16 px. python3 -I tools/make_logo.py
import os
def f(x): return f"{x:.2f}".rstrip("0").rstrip(".")
def rect(x,y,w,h,c,rx=0): return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"{f" rx={chr(34)}{f(rx)}{chr(34)}" if rx else ""} fill="{c}"/>'
def poly(pts,c): return f'<polygon points="{" ".join(f(x)+","+f(y) for x,y in pts)}" fill="{c}"/>'

CASE_TOP="#d6d1c4"; CASE_SIDE="#aaa497"; CASE_EDGE="#bfb9ac"; RAISED="#ddd8cc"; SLOPE="#b8b2a5"
WELL="#2b2c2e"; KEY="#c4b8a6"; KEY_DARK="#a99d8b"; BLUE="#2456b8"

def machine(detail):
    out=[]
    # the case: a chamfered outline, its lower and right edges in shade, then its top
    X0,X1,Y0,Y1,c=3,61,9,55,3
    out.append(poly([(X0+c,Y0),(X1-c,Y0),(X1,Y0+c),(X1,Y1-c),(X1-c,Y1),(X0+c,Y1),(X0,Y1-c),(X0,Y0+c)],CASE_SIDE))
    out.append(poly([(X0+c,Y0),(X1-c,Y0),(X1,Y0+c),(X1-1.6,Y0+c+0.6),(X0+c+0.6,Y0+1.6),(X0+1.6,Y0+c+0.6),(X0,Y0+c)],CASE_EDGE))
    i=1.6
    out.append(poly([(X0+c+0.6,Y0+i),(X1-c-0.6,Y0+i),(X1-i,Y0+c+0.6),(X1-i,Y1-c-0.8),(X1-c-0.8,Y1-i-0.4),(X0+c+0.6,Y1-i-0.4),(X0+i,Y1-c-0.8),(X0+i,Y0+c+0.6)],CASE_TOP))
    # the raised part at the back, and its slope down to the deck
    out.append(poly([(X0+i+1,Y0+i+0.8),(X1-i-1,Y0+i+0.8),(X1-i-1,19.2),(X0+i+1,19.2)],RAISED))
    out.append(poly([(X0+i+1,19.2),(X1-i-1,19.2),(X1-i-2,21.6),(X0+i+2,21.6)],SLOPE))
    # the speaker grille at the left, the expansion slot's cover at the right
    for k in range(6 if detail else 4):
        step=2.0 if detail else 3.0
        out.append(rect(8.5+k*step,12.2,0.9 if detail else 1.4,5.4,"#8f897d"))
    out.append(rect(38,13.2,16,3.6,"#c6c0b3",0.6))
    if detail:
        # the F keys and Quit, the nameplate, the lamp
        out.append(rect(7.6,24.2,24.6,3.6,WELL,0.4))
        for k in range(6):
            out.append(rect(8.1+k*4.0 + (1.0 if k else 0),24.6,3.1 if k else 3.3,2.8,KEY,0.4))
        out.append(rect(35.5,24.3,13,3.4,"#f2efe6",0.3))
        out.append(rect(36.1,24.9,7.2,1.0,BLUE))
        out.append(rect(36.1,26.4,7.2,0.7,BLUE))
        for k,cc in enumerate(["#d8332b","#2f9a45","#2456b8"]): out.append(poly([(44.2+k*1.0,27.2),(45.0+k*1.0,24.8),(45.6+k*1.0,24.8),(44.8+k*1.0,27.2)],cc))
        out.append(f'<circle cx="54" cy="26" r="0.75" fill="#e0402c"/>')
    else:
        out.append(rect(36,24.2,12,3.4,BLUE,0.4))
    # the key well and the keys
    out.append(poly([(6.8,30),(46.2,30),(46.2,47.2),(38.5,47.2),(38.5,51.2),(14.2,51.2),(14.2,47.2),(6.8,47.2)],WELL))
    if detail:
        rows=[(31.0,12,0.0),(35.0,12,1.2),(39.0,11,2.0),(43.0,11,3.0)]
        for y,n,dx in rows:
            w=38.6/12-0.55
            for k in range(n):
                out.append(rect(7.3+dx+k*(38.6/12),y,w,3.2,KEY,0.35))
                out.append(rect(7.3+dx+k*(38.6/12),y+2.45,w,0.75,KEY_DARK,0.3))
        out.append(rect(14.7,47.6,4.0,3.2,KEY,0.35)); out.append(rect(19.2,47.6,14.8,3.2,KEY,0.35)); out.append(rect(34.5,47.6,3.5,3.2,KEY,0.35))
        out.append(rect(14.7,50.05,23.3,0.75,KEY_DARK,0.3))
    else:
        for y in (32.0,37.4,42.8):
            out.append(rect(8.6,y,35.8,2.6,KEY,0.4))
        out.append(rect(16.4,47.9,20.4,2.2,KEY,0.4))
    # the arrow keys' panel: a square of four triangles, each facing its own way to the light
    cx,cy,r=53.2,40.0,6.6
    out.append(rect(cx-r-0.8,cy-r-0.8,2*r+1.6,2*r+1.6,"#c9c3b6",1.2))
    a,b,cc,d=(cx-r,cy-r),(cx+r,cy-r),(cx+r,cy+r),(cx-r,cy+r)
    g=0.35
    for pts,col in (([a,b],"#ddd4c3"),([b,cc],"#c3b7a4"),([cc,d],"#ab9f8c"),([d,a],"#cfc5b3")):
        (x1,y1),(x2,y2)=pts
        mx=(x1+x2)/2; my=(y1+y2)/2
        sx=(cx-mx)*0.06; sy=(cy-my)*0.06
        out.append(poly([(x1+sx,y1+sy),(x2+sx,y2+sy),(cx+(mx-cx)*g*0.1,cy+(my-cy)*g*0.1)],col))
    return out

for name,detail in (("logo",True),("favicon",False)):
    body="\n  ".join(machine(detail))
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images", f"{name}.svg"),"w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
  <!-- The simulator's mark: the CEC-I from above, drawn low poly{" and simplified, to read at 16 px" if not detail else ""}: the case, the raised back with its grille and slot, the keys in their dark well, the nameplate, the arrow keys' panel. Our own drawing, not the machine's or a maker's logo. -->
  {body}
</svg>
''')
