// Copy audit: node --experimental-strip-types scripts/audit-copy.mjs
// Walks every string literal in src/, then checks the Chinese copy and its English translation.
import ts from 'typescript';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {translate,entries}=await import(path.join(root,'src/i18n.ts'));
const CJK=/[㐀-鿿]/,DOT='·';
const files=[];
(function walk(dir){for(const name of readdirSync(dir)){const p=path.join(dir,name);if(statSync(p).isDirectory())walk(p);else if(p.endsWith('.ts'))files.push(p);}})(path.join(root,'src'));
const chunks=[];   // every literal, used for the dot check and the orphan check
const whole=[];    // complete sentences only (no markup, no template holes): safe to translate in isolation
for(const file of files){
  if(file.endsWith('src/i18n.ts'))continue;
  const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.ES2022,true);
  const visit=node=>{
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)){
      const text=node.text;
      if(CJK.test(text)){
        const item={file:path.relative(root,file),line:sf.getLineAndCharacterOfPosition(node.getStart()).line+1,text};
        chunks.push(item);
        if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&!text.includes('<')&&!/^[\s，：、]/.test(text)&&!/[\s，：]$/.test(text))whole.push(item);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(sf);
}
// Source files are exempt from translation for these: language names are shown in their own language.
const exempt=new Set(['中文']);
const problems={dotsZh:[],untranslated:[],dotsEn:[],orphans:[],dotsDict:[]};
for(const c of chunks)if(c.text.includes(DOT))problems.dotsZh.push(c);
for(const c of whole){
  if(exempt.has(c.text.trim()))continue;
  const en=translate(c.text,'en');
  if(CJK.test(en))problems.untranslated.push({...c,en});
  if(en.includes(DOT))problems.dotsEn.push({...c,en});
}
const allText=chunks.map(c=>c.text).join('\n');
for(const [k,v] of Object.entries(entries)){
  if(k.includes(DOT)||v.includes(DOT))problems.dotsDict.push([k,v]);
  if(!allText.includes(k))problems.orphans.push(k);
}
const show=(title,list,fmt)=>{console.log(`\n${title}: ${list.length}`);for(const item of list.slice(0,200))console.log('  '+fmt(item));};
show('Chinese strings with a middle dot',problems.dotsZh,c=>`${c.file}:${c.line} ${c.text}`);
show('Strings still containing Chinese in English mode',problems.untranslated,c=>`${c.file}:${c.line} ${c.text}  =>  ${c.en}`);
show('English output containing a middle dot',problems.dotsEn,c=>`${c.file}:${c.line} ${c.en}`);
show('Dictionary entries with a middle dot',problems.dotsDict,([k,v])=>`${k} => ${v}`);
show('Dictionary keys never used by any source string',problems.orphans,k=>k);
const bad=problems.dotsZh.length+problems.untranslated.length+problems.dotsEn.length+problems.dotsDict.length;
console.log(`\nliterals scanned: ${chunks.length} (${whole.length} complete sentences checked in English); blocking problems: ${bad}; orphan keys: ${problems.orphans.length}`);
process.exit(bad?1:0);
