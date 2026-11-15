(function(){
  'use strict';
  const content=window.PulsoWelcomeAudioContent,audio=document.getElementById('welcomeInstructionAudio');
  if(!content||!audio)return;
  const $=id=>document.getElementById(id),pause=$('welcomeAudioPause'),stop=$('welcomeAudioStop'),status=$('welcomeAudioStatus');
  const buttons={en:$('welcomeAudioEnglish'),es:$('welcomeAudioSpanish')};
  let selected=null,intent='stopped',request=0;
  const en=()=>document.documentElement.lang==='en';
  const text=(es,english)=>en()?english:es;
  function label(){
    pause.textContent=intent==='paused'?text('Continuar guía','Resume guide'):text('Pausar guía','Pause guide');
    pause.setAttribute('aria-disabled',String(!selected||intent==='stopped'));
    stop.setAttribute('aria-disabled',String(!selected||intent==='stopped'));
    for(const lang of ['en','es'])buttons[lang].setAttribute('aria-pressed',String(selected===lang&&intent!=='stopped'));
  }
  function announce(message){status.textContent=message;}
  function halt(announceStop=true){request++;intent='stopped';audio.pause();try{audio.currentTime=0;}catch(_){}label();if(announceStop)announce(text('Guía detenida.','Guide stopped.'));}
  async function play(lang,resume=false){
    const token=++request;audio.pause();
    if(!resume||selected!==lang){audio.src=content[lang].src;try{audio.currentTime=0;}catch(_){}}
    selected=lang;intent='playing';audio.lang=content[lang].language;label();
    try{await audio.play();if(token!==request||intent!=='playing'){if(intent!=='playing')audio.pause();return;}announce(text('Guía en '+(lang==='es'?'español':'inglés')+'.','Guide in '+(lang==='es'?'Spanish':'English')+'.'));}
    catch(error){if(token!==request)return;intent='stopped';label();announce(text('No se pudo reproducir la guía. Puedes leer la transcripción o descargar el audio.','The guide could not play. Read the transcript or download the audio.'));}
  }
  for(const lang of ['en','es']){
    buttons[lang].addEventListener('click',()=>play(lang));
    const transcript=$('welcomeTranscript'+(lang==='en'?'English':'Spanish'));
    for(const paragraph of content[lang].paragraphs){const p=document.createElement('p');p.textContent=paragraph;transcript.append(p);}
  }
  pause.addEventListener('click',()=>{if(!selected||intent==='stopped')return;if(intent==='paused'){play(selected,true);return;}request++;intent='paused';audio.pause();label();announce(text('Guía en pausa.','Guide paused.'));});
  stop.addEventListener('click',()=>{if(intent!=='stopped')halt();});
  audio.addEventListener('ended',()=>{intent='stopped';label();announce(text('Guía terminada. Llega al botón Iniciar para entrar.','Guide finished. Move to Start to enter.'));});
  audio.addEventListener('play',()=>{if(intent!=='playing')audio.pause();});
  $('welcomeStart').addEventListener('click',()=>halt(false),true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('welcomeScreen').hidden&&intent!=='stopped')halt();});
  window.addEventListener('pagehide',()=>halt(false));
  new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  label();
  window.PulsoWelcomeAudio={stop:()=>halt(false)};
})();
