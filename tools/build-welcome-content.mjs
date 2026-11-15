import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const content=JSON.parse(await fs.readFile(new URL('docs/audio-guide-scripts.json',root),'utf8'));
for(const lang of ['en','es'])content[lang].src='assets/instructions/nvda-'+lang+'.mp3';
await fs.writeFile(new URL('dist/welcome-audio-content.js',root),'/* Generated from docs/audio-guide-scripts.json. */\nwindow.PulsoWelcomeAudioContent='+JSON.stringify(content)+';\n');
