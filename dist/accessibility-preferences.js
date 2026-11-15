/* Display preferences only. This controller never enables or changes audio. */
(function () {
  'use strict';
  const root=document.documentElement;
  const preferences=[
    {attribute:'data-high-contrast',className:'high-contrast',key:'pulsoterra-high-contrast',on:'Desactivar alto contraste',off:'Activar alto contraste'},
    {attribute:'data-large-text',className:'large-text',key:'pulsoterra-large-text',on:'Usar tamaño de texto estándar',off:'Usar texto grande (125 %)'}
  ];
  const bound=new WeakSet();
  function saved(preference) {
    try {return localStorage.getItem(preference.key)==='1';}
    catch (_) {return false;}
  }
  function apply(preference,enabled) {
    root.classList.toggle(preference.className,enabled);
    document.querySelectorAll('['+preference.attribute+']').forEach(button=>{
      button.type='button';
      button.setAttribute('aria-pressed',String(enabled));
      button.title=enabled?preference.on:preference.off;
    });
  }
  preferences.forEach(preference=>apply(preference,saved(preference)));
  function initialize() {
    preferences.forEach(preference=>{
      apply(preference,root.classList.contains(preference.className));
      document.querySelectorAll('['+preference.attribute+']').forEach(button=>{
        if(bound.has(button))return;
        bound.add(button);
        button.addEventListener('click',()=>{
          const enabled=!root.classList.contains(preference.className);
          apply(preference,enabled);
          try {localStorage.setItem(preference.key,enabled?'1':'0');}
          catch (_) { /* Controls continue working when storage is unavailable. */ }
        });
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
  window.addEventListener('storage',event=>{
    preferences.forEach(preference=>{if(event.key===null||event.key===preference.key)apply(preference,saved(preference));});
  });
})();
