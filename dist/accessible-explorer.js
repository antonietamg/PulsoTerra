(function(){
  'use strict';
  function initialize(){
    const api=window.PulsoExplorer,$=id=>document.getElementById(id),panel=$('accessibleExplorer');
    if(!api||!panel)return;
    const ui={soundscape:$('accessibleSoundscape'),year:$('accessibleYear'),place:$('accessiblePlace'),row:$('accessibleRow'),column:$('accessibleColumn'),inspect:$('accessibleInspect'),previous:$('accessiblePrevious'),next:$('accessibleNext'),listen:$('accessibleListen'),pause:$('accessiblePause'),tour:$('accessibleTour'),read:$('accessibleRead'),summary:$('accessibleSummary'),reading:$('accessibleReading'),announcement:$('accessibleAnnouncement'),follow:$('accessibleFollow'),auto:$('accessibleAutoListen')};
    if(Object.values(ui).some(element=>!element))return;
    const T=(es,en)=>document.documentElement.lang.toLowerCase().startsWith('en')?en:es;
    const label=es=>T(es,window.PulsoI18n?.translate(es)||window.PulsoAccessibilityTranslations?.exact?.[es]||es);
    const number=(value,digits=2,signed=false)=>new Intl.NumberFormat(T('es','en'),{minimumFractionDigits:digits,maximumFractionDigits:digits,signDisplay:signed?'exceptZero':'auto'}).format(value);
    const finite=value=>typeof value==='number'&&Number.isFinite(value);
    const size=()=>{const s=api.gridSize();return {columns:Math.max(1,Math.trunc(s.columns)||32),rows:Math.max(1,Math.trunc(s.rows)||16)};};
    let current=api.snapshot(),previous=current,busy=false,formPinned=false,formReady=false,formGrid=null,formRevision=0,confirmedRevision=0,lastFollow=0,lastSelection='',lastStatus=current.status||'',announceToken=0,manualUntil=0,manualTimer=0,generalTimer=0,operationId=0;
    const fields=[ui.soundscape,ui.year,ui.place,ui.row,ui.column],editingField=()=>fields.includes(document.activeElement);
    ui.summary.setAttribute('data-no-i18n','');
    const optionSignatures=new WeakMap();
    function options(select,entries,value){
      if(document.activeElement===select)return;
      const signature=JSON.stringify(entries);
      if(optionSignatures.get(select)!==signature){
        const existing=Array.from(select.children);
        if(existing.length===entries.length&&entries.every((entry,i)=>existing[i].value===String(entry.id))){
          entries.forEach((entry,i)=>{if(existing[i].textContent!==entry.label)existing[i].textContent=entry.label;});
        }else{
          const nodes=entries.map(entry=>{const o=document.createElement('option');o.value=String(entry.id);o.textContent=entry.label;o.setAttribute('data-no-i18n','');return o;});
          select.replaceChildren(...nodes);
        }
        optionSignatures.set(select,signature);
      }
      if(select.value!==String(value)&&entries.some(entry=>String(entry.id)===String(value)))select.value=String(value);
    }
    function selectionKey(s){const p=s.selection;return p?[p.frameId,p.x,p.y,p.row,p.col,p.value].join('|'):'';}
    function position(s){const grid=size(),p=s.selection;return {grid,row:p?Math.max(0,Math.min(grid.rows-1,p.row)):0,col:p?Math.max(0,Math.min(grid.columns-1,p.col)):0};}
    function placeFor(s){const p=s.selection,c=p?.coordinates;if(!c||!finite(c.lat)||!finite(c.lon))return '';return String(api.places.find(place=>Math.abs(place.lat-c.lat)<.05&&Math.abs(place.lon-c.lon)<.05)?.id||'');}
    function coordinates(p){const c=p.coordinates;if(!c||!finite(c.lat)||!finite(c.lon))return '';return T('Latitud '+number(c.lat,1)+' grados; longitud '+number(c.lon,1)+' grados.','Latitude '+number(c.lat,1)+' degrees; longitude '+number(c.lon,1)+' degrees.');}
    function areaReading(s,full){
      const p=s.selection,year=p?.frameId||s.selected;
      if(!p)return T('Año '+year+'. Elige una región o una fila y columna, y pulsa Consultar zona.','Year '+year+'. Choose a region or a row and column, then select Check this area.');
      const {grid,row,col}=position(s),parts=[T('Año '+year+'.','Year '+year+'.')];
      if(s.collection==='impacts')parts.push(T('Paisaje: '+label(s.impact.label)+'.','Soundscape: '+label(s.impact.label)+'.'));
      else if(p.region?.label)parts.push(label(p.region.label)+'.');
      parts.push(T('Fila '+(row+1)+' de '+grid.rows+', columna '+(col+1)+' de '+grid.columns+'.','Row '+(row+1)+' of '+grid.rows+', column '+(col+1)+' of '+grid.columns+'.'));
      if(full){const c=coordinates(p);if(c)parts.push(c);}
      if(!finite(p.value)){
        parts.push(T('Sin datos válidos para esta zona.','No valid data for this area.'));
        parts.push(s.original?T('La referencia original puede escucharse sin latido.','The original reference can play without a heartbeat.'):T('Esta zona permanece en silencio.','This area remains silent.'));
        return parts.join(' ');
      }
      parts.push(T('Anomalía aproximada '+number(p.value,2,true)+' grados Celsius respecto a 1951–1980.','Approximate anomaly '+number(p.value,2,true)+' degrees Celsius relative to 1951–1980.'));
      if(!full)return parts.join(' ');
      const pulse=s.pulse,music=s.music;
      if(s.collection==='geography'){
        if(s.original)parts.push(T('Referencia musical original: 100 BPM, sin transposición y sin latido.','Original musical reference: 100 BPM, no transposition and no heartbeat.'));
        else if(music&&finite(music.semitones)&&finite(music.rate))parts.push(T('Transposición '+number(music.semitones,1,true)+' semitonos; velocidad '+number(music.rate,2)+' veces la original.','Transposition '+number(music.semitones,1,true)+' semitones; tempo '+number(music.rate,2)+' times the original.'));
        parts.push(T('Se conserva la armonía del MIDI.','The MIDI harmony is preserved.'));
      }else if(pulse){
        const notes=T(['Do','Do sostenido','Re','Mi bemol','Mi','Fa','Fa sostenido','Sol','La bemol','La','Si bemol','Si'],['C','C sharp','D','E flat','E','F','F sharp','G','A flat','A','B flat','B']);
        if(finite(pulse.midi))parts.push(T('Nota guía '+notes[((pulse.midi%12)+12)%12]+(Math.floor(pulse.midi/12)-1)+'.','Guide note '+notes[((pulse.midi%12)+12)%12]+(Math.floor(pulse.midi/12)-1)+'.'));
        parts.push(pulse.mode==='minor'?T('Modo menor de referencia.','Minor reference mode.'):T('Modo mayor de referencia.','Major reference mode.'));
        if(['biodiversity','economy'].includes(s.impact.id))parts.push(T('Animales y percusión conservan su altura natural.','Animal calls and percussion retain their natural pitch.'));
      }
      if(pulse&&!s.original){
        const enabled=$('heartbeat')?.checked!==false;
        parts.push(T((enabled?'Latido expresivo: ':'Latido apagado; referencia expresiva: ')+pulse.bpm+' BPM'+(pulse.irregular?', con intervalos irregulares.':', estable.'),(enabled?'Expressive heartbeat: ':'Heartbeat off; expressive reference: ')+pulse.bpm+' BPM'+(pulse.irregular?', with irregular intervals.':', steady.')));
      }
      parts.push(T('Interpretación sonora; no mide daños ni una respuesta cardíaca real.','A sound interpretation, not a measurement of damage or an actual cardiac response.'));
      return parts.join(' ');
    }
    function summary(s){
      if(!s.ready)return T('Preparando el mapa. Los controles estarán disponibles cuando termine la carga.','Preparing the map. Controls will be available when loading finishes.');
      if(!s.validCount)return T('Este mapa aún no tiene un resumen de píxeles válidos.','A valid-pixel summary is not available for this map yet.');
      const fractions=(s.histogram||[]).map(v=>finite(v)?Math.max(0,v):0),total=fractions.reduce((a,b)=>a+b,0);
      const names=T(['mucho más fríos','más fríos','cerca de la referencia','más cálidos','mucho más cálidos'],['much cooler','cooler','near the reference','warmer','much warmer']);
      const values=names.map((name,i)=>number((fractions[i]||0)/(total>1.01?total:1)*100,1)+'% '+name).join('; ');
      return T('Resumen de la imagen '+s.selected+': '+number(s.validCount,0)+' píxeles con lectura válida. '+values+'. Son proporciones de píxeles sin ponderación por área; no son una media global ni miden impactos.','Image '+s.selected+' summary: '+number(s.validCount,0)+' pixels with valid readings. '+values+'. These pixel proportions are not area-weighted; they are not a global average or measurements of impacts.');
    }
    function formOptions(values){
      const grid=formGrid;
      options(ui.soundscape,api.soundscapes.map(s=>({id:s.id,label:label(s.label)})),values.soundscape);
      options(ui.year,api.frames.map(f=>({id:f.id,label:label(f.label)})),values.year);
      options(ui.place,[{id:'',label:T('Elegir una región','Choose a region')},...api.places.map(p=>({id:p.id,label:label(p.label)}))],values.place);
      options(ui.row,Array.from({length:grid.rows},(_,i)=>({id:i,label:String(i+1)+(i===0?T(' · norte',' · north'):i===grid.rows-1?T(' · sur',' · south'):'')})),values.row);
      options(ui.column,Array.from({length:grid.columns},(_,i)=>({id:i,label:String(i+1)+(i===0?T(' · oeste',' · west'):i===grid.columns-1?T(' · este',' · east'):'')})),values.column);
    }
    function syncForm(s){
      if(editingField())return;
      formGrid=size();formReady=true;
      const pos=position(s);formOptions({soundscape:s.collection==='geography'?'geography':s.impact.id,year:s.selected,place:placeFor(s),row:pos.row,column:pos.col});
    }
    function render(s){
      current=s;const grid=size();
      if(!formReady||(!formPinned&&!editingField()&&!busy&&!s.playing))syncForm(s);
      else formOptions({soundscape:ui.soundscape.value,year:ui.year.value,place:ui.place.value,row:ui.row.value,column:ui.column.value});
      const summaryText=summary(s),readingText=areaReading(s,true);
      if(ui.summary.textContent!==summaryText)ui.summary.textContent=summaryText;
      if(ui.reading.textContent!==readingText)ui.reading.textContent=readingText;
      const blocked=!s.ready||s.preparing||busy;
      // Query fields remain available while data loads. Native focus is never removed.
      for(const control of fields)control.disabled=false;
      for(const control of [ui.inspect,ui.previous,ui.next,ui.listen,ui.tour]){control.disabled=false;control.setAttribute('aria-disabled',String(blocked));}
      const p=s.selection,index=p?position(s).row*grid.columns+position(s).col:-1;
      ui.previous.setAttribute('aria-disabled',String(blocked||index<=0));ui.next.setAttribute('aria-disabled',String(blocked||index>=grid.rows*grid.columns-1));
      ui.listen.setAttribute('aria-disabled',String(blocked||!p||(!s.original&&!finite(p.value))));
      // Pausing remains available during loading and sample preparation.
      ui.pause.disabled=false;ui.reading.setAttribute('aria-busy',String(Boolean(s.preparing||busy)));
    }
    function announce(text){
      if(!text||document.body.classList.contains('welcome-open'))return;
      const token=++announceToken;lastFollow=Date.now();ui.announcement.textContent='';
      setTimeout(()=>{if(token===announceToken)ui.announcement.textContent=text;},40);
    }
    function later(text){clearTimeout(generalTimer);generalTimer=setTimeout(()=>{if(!busy)announce(text);},180);}
    function cancelAction(){operationId++;busy=false;clearTimeout(manualTimer);clearTimeout(generalTimer);render(api.snapshot());}
    async function action(control,operation,message,onSuccess){
      if(busy||!current.ready||current.preparing||control.getAttribute('aria-disabled')==='true')return;
      const request=++operationId,focused=document.activeElement===control,collection=current.collection,detail=current.detail;
      const isCurrent=()=>request===operationId&&api.snapshot().collection===collection&&api.snapshot().detail===detail;
      busy=true;clearTimeout(manualTimer);clearTimeout(generalTimer);render(current);
      try{await operation(isCurrent);if(!isCurrent())return;current=api.snapshot();if(onSuccess)onSuccess(current);if(message)announce(typeof message==='function'?message(current):message);}
      catch(error){if(request===operationId)announce(T('No se pudo completar la acción. ','The action could not be completed. ')+label(error?.message||String(error)));}
      finally{if(request===operationId){busy=false;render(api.snapshot());if(focused&&!control.disabled&&(document.activeElement===document.body||document.activeElement===control))try{control.focus({preventScroll:true});}catch(_){control.focus();}}}
    }
    function inspectGrid(row,col){return api.inspect({row,col});}
    for(const control of fields){
      control.addEventListener('focus',()=>{formPinned=true;});
      control.addEventListener('change',()=>{formPinned=true;formRevision++;if(control===ui.row||control===ui.column)ui.place.value='';});
      control.addEventListener('blur',()=>{render(api.snapshot());});
    }
    ui.inspect.addEventListener('click',()=>{
      if(busy||!current.ready||current.preparing||ui.inspect.getAttribute('aria-disabled')==='true')return;
      const query={soundscape:ui.soundscape.value,year:ui.year.value,placeId:ui.place.value,row:Number(ui.row.value),col:Number(ui.column.value)},revision=formRevision;
      formPinned=true;
      // Switch synchronously before action captures the collection/grid context.
      api.selectSoundscape(query.soundscape);
      action(ui.inspect,async isCurrent=>{
        if(query.year!==api.snapshot().selected)await api.selectYear(query.year);
        if(!isCurrent()||!api.snapshot().ready)return;
        await api.inspect(query.placeId?{placeId:query.placeId}:{row:query.row,col:query.col});
      },s=>areaReading(s,false),s=>{if(revision===formRevision){confirmedRevision=revision;if(!editingField())syncForm(s);}});
    });
    function move(direction,button){
      if(busy||!current.ready||current.preparing)return;
      if(button.getAttribute('aria-disabled')==='true'){announce(direction<0?T('Estás en la primera zona.','You are at the first area.'):T('Estás en la última zona.','You are at the last area.'));return;}
      const grid=size(),p=current.selection,index=p?position(current).row*grid.columns+position(current).col:-1;
      const next=Math.max(0,Math.min(grid.rows*grid.columns-1,index+direction)),revision=formRevision;
      formPinned=true;
      action(button,async isCurrent=>{await inspectGrid(Math.floor(next/grid.columns),next%grid.columns);if(!isCurrent())return;const s=api.snapshot();if(ui.auto.checked&&(s.original||finite(s.selection?.value)))await api.listen();},s=>ui.auto.checked&&(s.original||finite(s.selection?.value))?T('Escuchando la zona elegida.','Playing the selected area.'):areaReading(s,false),s=>{if(revision===formRevision&&revision===confirmedRevision&&!editingField())syncForm(s);});
    }
    ui.previous.addEventListener('click',()=>move(-1,ui.previous));ui.next.addEventListener('click',()=>move(1,ui.next));
    ui.listen.addEventListener('click',()=>action(ui.listen,()=>api.listen(),T('Escuchando la zona elegida.','Playing the selected area.')));
    ui.pause.addEventListener('click',()=>{cancelAction();api.pause();clearTimeout(generalTimer);announce(T('Todo el audio en pausa.','All audio paused.'));});
    ui.tour.addEventListener('click',()=>action(ui.tour,()=>api.tour(),T('Recorrido iniciado. Puedes pausar todo el audio o pulsar Escape.','Tour started. You can pause all audio or press Escape.')));
    ui.read.addEventListener('click',()=>announce(areaReading(api.snapshot(),true)));
    ui.follow.addEventListener('change',()=>{lastFollow=Date.now();});
    function update(s){
      const before=previous,key=selectionKey(s),changed=key!==lastSelection;render(s);previous=s;lastSelection=key;
      const status=s.status||'',statusChanged=status!==lastStatus;lastStatus=status;
      if(s.playing)clearTimeout(manualTimer);
      if(busy||document.body.classList.contains('welcome-open'))return;
      if(changed&&!s.playing&&Date.now()<manualUntil&&['mapStage','regionSelect'].includes(document.activeElement?.id)){
        clearTimeout(manualTimer);manualTimer=setTimeout(()=>announce(areaReading(api.snapshot(),false)),220);return;
      }
      if(ui.follow.checked&&s.playing&&changed&&Date.now()-lastFollow>=4000){announce(areaReading(s,false));return;}
      if(statusChanged&&/terminad|finalizad|en pausa|reiniciad|sin datos|sin píxeles|no se pudo|error|tema .*seleccionado|latido activado|latido silenciado|preferencia de latido/i.test(status)&&!/^Recorrido por filas|^Comparando |^Explorando el mapa/i.test(status)){later(label(status));return;}
      if(!before.ready&&s.ready){later(T('Mapa de '+s.selected+' listo.','Map for '+s.selected+' ready.'));return;}
      if(!before.playing&&s.playing)later(T('Reproducción iniciada.','Playback started.'));
      else if(before.playing&&!s.playing&&!s.preparing)later(T('Audio en pausa.','Audio paused.'));
    }
    api.subscribe(update);render(current);lastSelection=selectionKey(current);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&busy&&!$('infoDialog')?.open)cancelAction();if(event.target?.id==='mapStage'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))manualUntil=Date.now()+2000;},true);
    document.addEventListener('change',event=>{if(event.target?.id==='regionSelect')manualUntil=Date.now()+2000;},true);
    $('mapStage')?.addEventListener('pointermove',()=>{manualUntil=0;clearTimeout(manualTimer);},true);
    document.querySelectorAll('[data-open-explorer]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();panel.open=true;const target=panel.querySelector('summary');target?.focus();panel.scrollIntoView({block:'start',behavior:'auto'});}));
    new MutationObserver(()=>{announceToken++;ui.announcement.textContent='';render(api.snapshot());}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
