(function () {
  'use strict';
  const content=window.PulsoGuideContent,panel=document.getElementById('listeningGuide');
  if(!content||!panel)return;
  const controls=document.getElementById('guideTopics'),title=document.getElementById('guideTopicTitle'),narrative=document.getElementById('guideNarrative'),buttons=[];
  let selectionRequest=0;
  function select(index,source=null){
    const c=content.chapters[index];title.textContent=c.heading.es;narrative.textContent=c.es;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i)));
    const request=++selectionRequest;
    if(source)setTimeout(()=>{
      // Let the language observer finish before explicitly reading a chosen step.
      // Language changes alone never move focus or announce the whole paragraph.
      if(request!==selectionRequest||(document.activeElement!==source&&document.activeElement!==document.body))return;
      try{title.focus({preventScroll:true});}catch(_){title.focus();}
    },0);
  }
  content.chapters.forEach((c,index)=>{const b=document.createElement('button');b.type='button';b.textContent=c.title.es;b.setAttribute('aria-controls','guideArticle');b.addEventListener('click',()=>select(index,b));buttons.push(b);controls.append(b);});
  select(0);
  function animate(video,motion,container){
    if(!video||!motion||!container)return;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)'),icon=motion.querySelector('[data-motion-icon]');
    let visible=false,userPlayback=null;
    video.defaultMuted=true;video.muted=true;video.volume=0;
    function label(){const text=video.paused?'Animar guía':'Pausar guía';if(icon){icon.textContent=video.paused?'▶':'Ⅱ';motion.setAttribute('aria-label',text);motion.title=text;}else motion.textContent=text;motion.setAttribute('aria-pressed',String(!video.paused));}
    function canPlay(){return visible&&!document.hidden&&!document.body.classList.contains('welcome-open')&&(userPlayback===true||(userPlayback===null&&!preference.matches));}
    function update(){
      if(canPlay()){if(video.paused){const p=video.play();if(p)p.then(()=>{if(!canPlay())video.pause();label();}).catch(label);}else label();}
      else{video.pause();label();}
    }
    motion.addEventListener('click',()=>{userPlayback=video.paused;update();});video.addEventListener('play',label);video.addEventListener('pause',label);
    if(window.IntersectionObserver)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update();},{threshold:.1}).observe(container);else{visible=true;update();}
    new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});document.addEventListener('visibilitychange',update);
    if(preference.addEventListener)preference.addEventListener('change',update);window.addEventListener('pagehide',()=>{userPlayback=false;video.pause();});
  }
  animate(document.getElementById('guideVideo'),document.getElementById('guideMotion'),panel);
  animate(document.getElementById('impactVideo'),document.getElementById('impactMotion'),document.querySelector('.impact-story'));
})();
