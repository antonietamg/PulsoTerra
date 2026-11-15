import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const documents=[...fs.readdirSync(root).filter(n=>n.endsWith('.md')).map(n=>path.join(root,n)),...fs.readdirSync(path.join(root,'docs')).filter(n=>n.endsWith('.md')).map(n=>path.join(root,'docs',n))];
for(const file of documents)for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
 const link=match[1].replace(/^<|>$/g,'').split('#')[0];
 if(!link||/^[a-z]+:/i.test(link))continue;
 const target=path.resolve(path.dirname(file),decodeURIComponent(link));
 if(!fs.existsSync(target))throw new Error('Broken documentation link: '+path.relative(root,file)+' -> '+link);
}
const provenance=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/instructions/provenance.json'),'utf8').replace(/^\uFEFF/,''));
for(const item of provenance){const data=fs.readFileSync(path.join(root,'dist/assets/instructions',item.file));if(crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw new Error('Audio hash mismatch: '+item.file);}
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'dist/welcome-audio-content.js'),'utf8'),context);
const scripts=JSON.parse(fs.readFileSync(path.join(root,'docs/audio-guide-scripts.json'),'utf8'));
for(const language of ['en','es'])if(JSON.stringify(context.window.PulsoWelcomeAudioContent[language].paragraphs)!==JSON.stringify(scripts[language].paragraphs))throw new Error('Transcript mismatch: '+language);
for(const name of ['PulsoTerra-sin-internet.html','Escuchar-sonidos-PulsoTerra.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');let count=0;
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=|application\/json|application\/ld\+json/i.test(match[1]))continue;
  new vm.Script(match[2],{filename:name+':'+(++count)});
 }
 if(name.startsWith('PulsoTerra-')&&/assets\/instructions\/nvda-(en|es)\.mp3/.test(html))throw new Error('Instructions are not embedded offline.');
 console.log(name+': '+count+' inline scripts parsed');
}
console.log('Verified '+documents.length+' English documentation files, local links, audio hashes, and transcript parity.');
