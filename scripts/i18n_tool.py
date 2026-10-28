"""Helpers for src/i18n.ts: parse the dictionary, drop unused keys, re-emit it tidily."""
import re,sys,json,subprocess,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P=os.path.join(ROOT,'src/i18n.ts')
HEAD="export const entries:Record<string,string>={"
TAIL="\n};\nconst escapeRE"
def parse(body):
    pairs=[];i=0;n=len(body);toks=[]
    while i<n:
        c=body[i]
        if c in "'\"":
            q=c;j=i+1;out=[]
            while body[j]!=q:
                if body[j]=='\\':
                    out.append(body[j+1]);j+=2
                else:
                    out.append(body[j]);j+=1
            toks.append(''.join(out));i=j+1
        else:i+=1
    assert len(toks)%2==0
    return [(toks[k],toks[k+1]) for k in range(0,len(toks),2)]
def lit(t):
    if "'" in t and '"' not in t:return '"'+t.replace('\\','\\\\')+'"'
    return "'"+t.replace('\\','\\\\').replace("'","\\'")+"'"
def load():
    s=open(P,encoding='utf-8').read()
    i=s.index(HEAD)+len(HEAD);j=s.index(TAIL)
    return s,i,j,parse(s[i:j])
def emit(pairs):
    seen={};
    for k,v in pairs:seen[k]=v   # later wins
    items=[f"{lit(k)}:{lit(v)}," for k,v in seen.items()]
    lines=[];cur=''
    for it in items:
        if len(cur)+len(it)>150 and cur:lines.append(cur);cur=''
        cur+=it
    if cur:lines.append(cur)
    return '\n'+'\n'.join(lines)
def write(pairs):
    s,i,j,_=load()
    open(P,'w',encoding='utf-8').write(s[:i]+emit(pairs)+s[j:])
if __name__=='__main__':
    cmd=sys.argv[1]
    s,i,j,pairs=load()
    if cmd=='count':print(len(pairs))
    if cmd=='prune':
        used=open(sys.argv[2],encoding='utf-8').read()
        keep=[(k,v) for k,v in pairs if k in used]
        print('kept',len(keep),'dropped',len(pairs)-len(keep))
        write(keep)
