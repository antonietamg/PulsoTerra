const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Run the complete production explorer. The fixture models native select focus,
// asynchronous map loading, DOM writes and API notifications; it is not an NVDA
// substitute. Real screen-reader testing remains a separate integration check.
const modulePath=path.join(__dirname,'../dist/accessible-explorer.js');

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function settle(){for(let i=0;i<10;i++)await Promise.resolve();}

function setup(){
  let document,clock=10000,timerId=0,heldYear=null;
  const timers=new Map(),observers=[],focusLog=[],disabledLog=[];
  class Element{
    constructor(id='',tagName='DIV'){
      this.id=id;this.tagName=tagName;this.parentElement=null;this.children=[];this.attrs={};this.dataset={};this.listeners={};
      this._value='';this._disabled=false;this._text='';this.checked=false;this.open=false;this.textWrites=0;this.optionReplacements=0;
      const classes=new Set();this.classList={add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)};
    }
    get value(){return this._value;}
    set value(value){const text=String(value);this._value=this.tagName==='SELECT'&&!this.children.some(o=>o.value===text)?'':text;}
    get disabled(){return this._disabled;}
    set disabled(value){this._disabled=Boolean(value);disabledLog.push({id:this.id,value:this._disabled});if(this._disabled&&document?.activeElement===this)setFocus(document.body);}
    get textContent(){return this._text;}
    set textContent(value){this.textWrites++;this._text=String(value??'');this.children=[];}
    get options(){return this.children;}
    get childNodes(){return this.children;}
    get selectedIndex(){return this.children.findIndex(o=>o.value===this.value);}
    set selectedIndex(index){this._value=this.children[index]?.value||'';}
    set innerHTML(value){if(value!=='')throw new Error('The fixture only supports clearing innerHTML');this.replaceChildren();}
    get innerHTML(){return '';}
    setAttribute(name,value){this.attrs[name]=String(value);if(name==='disabled')this.disabled=true;}
    getAttribute(name){return this.attrs[name]??null;}
    hasAttribute(name){return Object.hasOwn(this.attrs,name);}
    removeAttribute(name){delete this.attrs[name];if(name==='disabled')this.disabled=false;}
    addEventListener(type,fn,options){(this.listeners[type]??=[]).push({fn,capture:options===true||Boolean(options?.capture)});}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x.fn!==fn);}
    replaceChildren(...nodes){
      const flattened=nodes.flatMap(n=>n.tagName==='#DOCUMENT-FRAGMENT'?n.children:[n]);
      if(this.tagName==='SELECT')this.optionReplacements++;
      for(const child of this.children)child.parentElement=null;
      this.children=flattened;for(const child of flattened)child.parentElement=this;
      if(this.tagName==='SELECT'&&!flattened.some(o=>o.value===this._value))this._value=flattened[0]?.value||'';
    }
    appendChild(child){this.children.push(child);child.parentElement=this;if(this.tagName==='SELECT'&&this.children.length===1)this._value=child.value;return child;}
    append(...nodes){for(const node of nodes)this.appendChild(node);}
    contains(node){for(let p=node;p;p=p.parentElement)if(p===this)return true;return false;}
    matches(selector){return selector.split(',').some(s=>{s=s.trim();return s==='select'?this.tagName==='SELECT':s==='button'?this.tagName==='BUTTON':s==='input'?this.tagName==='INPUT':s==='summary'?this.tagName==='SUMMARY':s.startsWith('#')?this.id===s.slice(1):s==='[data-open-explorer]'?this.hasAttribute('data-open-explorer'):false;});}
    closest(selector){for(let p=this;p;p=p.parentElement)if(p.matches(selector))return p;return null;}
    querySelectorAll(selector){return descendants(this).filter(node=>node.matches(selector));}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    focus(){if(!this.disabled)setFocus(this);}
    blur(){if(document.activeElement===this)setFocus(document.body);}
    scrollIntoView(){}
  }
  class Select extends Element{constructor(id){super(id,'SELECT');}}
  function descendants(node){return node.children.flatMap(child=>[child,...descendants(child)]);}
  function dispatch(target,type,extra={}){
    const event=Object.assign({type,target,currentTarget:null,bubbles:!['focus','blur'].includes(type),defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}},extra);
    const ancestors=[];for(let p=target.parentElement;p;p=p.parentElement)ancestors.push(p);
    const invoke=(node,capture)=>{event.currentTarget=node;for(const entry of node.listeners?.[type]||[])if(entry.capture===capture)entry.fn(event);};
    invoke(document,true);for(const node of [...ancestors].reverse())invoke(node,true);invoke(target,true);invoke(target,false);
    if(event.bubbles&&!event.stopped){for(const node of ancestors)invoke(node,false);invoke(document,false);}
    return event;
  }
  function setFocus(next){
    const old=document.activeElement;if(old===next)return;
    document.activeElement=next;focusLog.push(next.id);
    if(old){dispatch(old,'blur',{relatedTarget:next});dispatch(old,'focusout',{relatedTarget:next});}
    dispatch(next,'focus',{relatedTarget:old});dispatch(next,'focusin',{relatedTarget:old});
  }
  const selectIds=['accessibleSoundscape','accessibleYear','accessiblePlace','accessibleRow','accessibleColumn'];
  const buttonIds=['accessibleInspect','accessiblePrevious','accessibleNext','accessibleListen','accessiblePause','accessibleTour','accessibleRead'];
  const otherIds=['accessibleExplorer','accessibleSummary','accessibleReading','accessibleAnnouncement','accessibleFollow','accessibleAutoListen','mapStage','regionSelect','heartbeat','infoDialog'];
  const elements=new Map([...selectIds.map(id=>[id,new Select(id)]),...buttonIds.map(id=>[id,new Element(id,'BUTTON')]),...otherIds.map(id=>[id,new Element(id)])]);
  const body=new Element('body','BODY'),html=new Element('html','HTML');html.lang='en';html.append(body);
  const panel=elements.get('accessibleExplorer'),summary=new Element('explorerSummary','SUMMARY'),link=new Element('skipExplorer','A');link.setAttribute('data-open-explorer','');link.setAttribute('href','#accessibleExplorer');
  body.append(link,panel);panel.append(summary);
  for(const [id,element]of elements)if(element!==panel)(id.startsWith('accessible')&&id!=='accessibleAnnouncement'?panel:body).append(element);
  elements.get('heartbeat').checked=true;
  document={readyState:'complete',documentElement:html,body,activeElement:body,listeners:{},getElementById:id=>elements.get(id)||null,createElement:tag=>new Element('',tag.toUpperCase()),createDocumentFragment:()=>new Element('','#DOCUMENT-FRAGMENT'),querySelectorAll:selector=>descendants(html).filter(n=>n.matches(selector)),querySelector:selector=>descendants(html).find(n=>n.matches(selector))||null,addEventListener:Element.prototype.addEventListener,removeEventListener:Element.prototype.removeEventListener};
  const frames=['1890','1920','1950','1980','2000','2023'].map(id=>({id,label:id}));
  const places=[{id:'a',label:'Punto A',lat:21,lon:-11},{id:'b',label:'Punto B',lat:-20,lon:40}];
  const soundscapes=[{id:'geography',label:'Mapa geográfico'},...[
    ['water','Agua'],['biodiversity','Biodiversidad'],['forests','Bosques'],['oceans','Océanos'],
    ['marine','Vida marina'],['humans','Personas'],['ice','Deshielo'],['economy','Economía']
  ].map(([id,label])=>({id,label}))];
  const state={collection:'geography',selected:'2023',impact:{id:'water',label:'Agua'},ready:true,preparing:false,playing:false,original:false,detail:12,status:'',selection:{frameId:'2023',x:.4,y:.5,row:2,col:3,value:.75,region:{label:'Zona de prueba'},coordinates:{lat:0,lon:0}},music:{semitones:-4.5,rate:1.3},pulse:{midi:68,bpm:90,mode:'major',irregular:false},histogram:[.1,.2,.3,.2,.2],validCount:1000};
  const calls={selectSoundscape:[],selectYear:[],inspect:[],inspectContext:[],order:[],listen:0,pause:0,tour:0},subscribers=[];
  const snapshot=()=>structuredClone(state),emit=()=>subscribers.forEach(fn=>fn(snapshot()));
  const gridSize=()=>state.collection==='impacts'?{columns:state.detail,rows:state.detail/2}:{columns:32,rows:16};
  const api={frames,places,soundscapes,snapshot,gridSize,subscribe(fn){subscribers.push(fn);return()=>{};},
    selectSoundscape(id){
      const chosen=soundscapes.find(s=>s.id===id);if(!chosen)throw new Error('Unknown soundscape '+id);
      calls.selectSoundscape.push(id);calls.order.push('soundscape:'+id);
      const changed=id==='geography'?state.collection!=='geography':state.collection!=='impacts'||state.impact.id!==id;
      if(changed){state.collection=id==='geography'?'geography':'impacts';if(id!=='geography')state.impact={id:chosen.id,label:chosen.label};state.original=false;state.playing=false;state.selection=null;}
      emit();return snapshot();
    },
    async selectYear(id){calls.selectYear.push(String(id));calls.order.push('year:'+id);state.ready=false;emit();const gate=heldYear;heldYear=null;if(gate)await gate.promise;state.selected=String(id);state.selection=null;state.ready=true;emit();return snapshot();},
    async inspect(point){calls.inspect.push(structuredClone(point));calls.inspectContext.push({collection:state.collection,impact:state.impact.id,year:state.selected,point:structuredClone(point)});calls.order.push('inspect:'+state.collection+':'+state.impact.id);const grid=gridSize(),place=places.find(p=>p.id===point.placeId);const row=place?1:Math.max(0,Math.min(grid.rows-1,Math.trunc(point.row)||0)),col=place?2:Math.max(0,Math.min(grid.columns-1,Math.trunc(point.col)||0));state.selection={frameId:state.selected,row,col,x:(col+.5)/grid.columns,y:(row+.5)/grid.rows,value:.75,region:{label:place?.label||'Zona de prueba'},coordinates:place?{lat:place.lat,lon:place.lon}:{lat:0,lon:0}};emit();return snapshot();},
    async listen(){calls.listen++;state.playing=true;emit();},pause(){calls.pause++;state.playing=false;state.preparing=false;state.status='Todo el audio en pausa';emit();},async tour(){calls.tour++;state.playing=true;emit();}
  };
  // The app installs its global Escape handler before loading the explorer.
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!elements.get('infoDialog').open)api.pause();});
  const context=vm.createContext({window:{PulsoExplorer:api,PulsoI18n:{translate:text=>text}},document,Element,HTMLElement:Element,HTMLSelectElement:Select,Node:{ELEMENT_NODE:1,TEXT_NODE:3},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}},Intl,Date:class extends Date{static now(){return clock;}},setTimeout(fn,delay=0){const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id),console});
  vm.runInContext(fs.readFileSync(modulePath,'utf8'),context,{filename:modulePath});
  const el=id=>elements.get(id);
  return {state,calls,api,el,document,focusLog,disabledLog,summary,link,emit,dispatch,
    choose(id,value){const node=el(id);node.focus();node.value=String(value);dispatch(node,'input');dispatch(node,'change');},
    click(id){const node=el(id);node.focus();dispatch(node,'click');},
    holdNextYear(){const gate=deferred();heldYear=gate;return gate;},
    flush(ms=500){const target=clock+ms;for(let guard=0;guard<1000;guard++){const entry=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;clock=entry[1].at;timers.delete(entry[0]);entry[1].fn();}clock=target;},
    selectedValues(){return Object.fromEntries(selectIds.map(id=>[id,el(id).value]));}
  };
}

test('soundscape, year and place arrow-style changes remain drafts without API, audio, disabling or lost focus',async()=>{
  const f=setup(),baseline=f.disabledLog.length;
  for(const [id,values]of [['accessibleSoundscape',['water','forests','geography']],['accessibleYear',['2000','1980','1890']],['accessiblePlace',['a','b','a']]]){
    for(const value of values){f.choose(id,value);await settle();assert.equal(f.document.activeElement,f.el(id));assert.equal(f.el(id).value,value);assert.equal(f.el(id).disabled,false);}
  }
  assert.deepEqual(f.calls.selectSoundscape,[]);assert.deepEqual(f.calls.selectYear,[]);assert.deepEqual(f.calls.inspect,[]);assert.equal(f.calls.listen,0);assert.equal(f.calls.tour,0);
  assert.equal(f.disabledLog.slice(baseline).some(x=>['accessibleSoundscape','accessibleYear','accessiblePlace'].includes(x.id)&&x.value),false);
});

test('tour snapshots and blur preserve all five drafts and the existing native option nodes',async()=>{
  const f=setup();f.choose('accessibleSoundscape','marine');f.choose('accessibleYear','1890');f.choose('accessibleRow','8');f.choose('accessibleColumn','9');f.choose('accessiblePlace','b');
  const values=f.selectedValues(),options=Object.fromEntries(Object.keys(values).map(id=>[id,[...f.el(id).options]]));
  f.el('accessiblePlace').blur();f.state.playing=true;f.state.selected='2000';f.state.selection={...f.state.selection,frameId:'2000',row:12,col:20,value:1.8};
  for(let i=0;i<8;i++)f.emit();await settle();
  assert.deepEqual(f.selectedValues(),values,'background playback must not overwrite an uncommitted form');
  for(const id of Object.keys(values)){assert.equal(f.el(id).options.length,options[id].length);f.el(id).options.forEach((node,i)=>assert.equal(node,options[id][i],'options must retain their identity'));}
  assert.deepEqual(f.calls.inspect,[]);assert.deepEqual(f.calls.selectYear,[]);
});

test('focusing a selector freezes the form before the first arrow or change event',()=>{
  const f=setup();f.el('accessibleYear').focus();const values=f.selectedValues();
  f.state.selected='1980';f.state.playing=true;f.state.selection={...f.state.selection,frameId:'1980',row:10,col:19};f.emit();
  assert.deepEqual(f.selectedValues(),values,'a focused native combo must not jump before the user commits a choice');
  assert.equal(f.document.activeElement,f.el('accessibleYear'));
});

test('Check loads the chosen year and place once while all selectors remain enabled',async()=>{
  const f=setup();f.choose('accessibleYear','1890');f.choose('accessiblePlace','b');const gate=f.holdNextYear();f.click('accessibleInspect');await settle();
  assert.deepEqual(f.calls.selectYear,['1890']);assert.deepEqual(f.calls.inspect,[]);
  for(const id of ['accessibleSoundscape','accessibleYear','accessiblePlace','accessibleRow','accessibleColumn'])assert.equal(f.el(id).disabled,false,id+' must remain editable during loading');
  assert.equal(f.el('accessibleYear').value,'1890','the draft year must not revert while its image loads');
  gate.resolve();await settle();assert.deepEqual(f.calls.inspect,[{placeId:'b'}]);assert.equal(f.calls.listen,0);
});

test('explicit row or column edits switch from the place draft to a grid consultation',async()=>{
  const f=setup();f.choose('accessiblePlace','b');f.choose('accessibleRow','5');f.choose('accessibleColumn','7');
  assert.equal(f.el('accessiblePlace').value,'','grid edits intentionally clear the place choice');
  f.click('accessibleInspect');await settle();assert.deepEqual(f.calls.inspect,[{row:5,col:7}]);assert.equal(f.calls.listen,0);
});

test('edits made during an old year consultation survive its eventual result',async()=>{
  const f=setup();f.choose('accessibleYear','1890');f.choose('accessiblePlace','b');const gate=f.holdNextYear();f.click('accessibleInspect');await settle();
  f.choose('accessibleYear','2000');f.choose('accessiblePlace','a');const newer=f.selectedValues();
  gate.resolve();await settle();
  assert.deepEqual(f.calls.selectYear,['1890']);assert.deepEqual(f.calls.inspect,[{placeId:'b'}],'the running request uses its captured choice');
  assert.deepEqual(f.selectedValues(),newer,'the completed request must not erase a newer draft');
  assert.equal(f.document.activeElement,f.el('accessiblePlace'));
});

for(const cancel of ['pause','escape'])test(cancel+' cancels consultation before an old year load can send inspect',async()=>{
  const f=setup();f.choose('accessibleYear','1890');f.choose('accessiblePlace','b');const gate=f.holdNextYear();f.click('accessibleInspect');await settle();
  if(cancel==='pause')f.click('accessiblePause');else f.dispatch(f.document.activeElement,'keydown',{key:'Escape'});
  gate.resolve();await settle();assert.equal(f.calls.pause,1);assert.deepEqual(f.calls.inspect,[]);assert.equal(f.calls.listen,0);
});

test('changing collection/grid while a selector is focused defers its options until Check',async()=>{
  const f=setup();f.choose('accessibleSoundscape','ice');f.choose('accessibleRow','12');const control=f.el('accessibleRow'),nodes=[...control.options];
  f.state.collection='impacts';f.state.impact={id:'ice',label:'Deshielo'};f.state.detail=8;f.state.selection=null;f.emit();await settle();
  assert.equal(f.document.activeElement,control);assert.equal(control.disabled,false);assert.equal(control.value,'12');assert.equal(control.options.length,16);
  control.options.forEach((node,i)=>assert.equal(node,nodes[i]));
  control.blur();f.emit();assert.equal(control.options.length,16,'blur alone does not discard or rebuild the draft');
  f.click('accessibleInspect');await settle();assert.equal(control.options.length,4);assert.equal(control.value,'3','the explicit consultation clamps to the new grid');
});

test('identical playback snapshots do not replace the text a screen reader may be reading',()=>{
  const f=setup(),summary=f.el('accessibleSummary'),reading=f.el('accessibleReading');
  const before={summary:summary.textWrites,reading:reading.textWrites};for(let i=0;i<15;i++)f.emit();
  assert.equal(summary.textWrites,before.summary);assert.equal(reading.textWrites,before.reading);
});

test('the explorer skip link opens details and focuses its native summary',()=>{
  const f=setup();f.link.focus();f.dispatch(f.link,'click');
  assert.equal(f.el('accessibleExplorer').open,true);assert.equal(f.document.activeElement,f.summary);
});

test('the native soundscape selector contains geography and all eight impact categories without changing the app',()=>{
  const f=setup(),select=f.el('accessibleSoundscape');
  assert.deepEqual(select.options.map(option=>option.value),['geography','water','biodiversity','forests','oceans','marine','humans','ice','economy']);
  assert.equal(select.value,'geography');assert.equal(select.disabled,false);
  const options=[...select.options];
  for(const id of f.api.soundscapes.map(soundscape=>soundscape.id)){
    f.choose('accessibleSoundscape',id);assert.equal(f.document.activeElement,select);assert.equal(select.value,id);
    select.options.forEach((option,index)=>assert.equal(option,options[index]));
  }
  assert.equal(f.state.collection,'geography');assert.deepEqual(f.calls.selectSoundscape,[]);
  assert.deepEqual(f.calls.selectYear,[]);assert.deepEqual(f.calls.inspect,[]);assert.equal(f.calls.listen,0);assert.equal(f.calls.tour,0);assert.equal(f.calls.pause,0);
});

test('Check can consult every impact category at the same chosen year and region without audio',async()=>{
  const f=setup();f.choose('accessibleYear','2000');f.choose('accessiblePlace','b');
  for(const soundscape of f.api.soundscapes.slice(1)){
    f.choose('accessibleSoundscape',soundscape.id);f.click('accessibleInspect');await settle();
    const inspected=f.calls.inspectContext.at(-1);
    assert.equal(inspected.collection,'impacts');assert.equal(inspected.impact,soundscape.id);assert.equal(inspected.year,'2000');assert.deepEqual(inspected.point,{placeId:'b'});
    assert.equal(f.el('accessibleSoundscape').value,soundscape.id);assert.equal(f.el('accessibleYear').value,'2000');assert.equal(f.el('accessiblePlace').value,'b');
    assert.ok(f.calls.order.indexOf('soundscape:'+soundscape.id)<f.calls.order.indexOf('inspect:impacts:'+soundscape.id),'soundscape must apply before the action captures and checks collection');
  }
  assert.deepEqual(f.calls.selectSoundscape,['water','biodiversity','forests','oceans','marine','humans','ice','economy']);
  assert.deepEqual(f.calls.selectYear,['2000']);assert.equal(f.calls.inspect.length,8);assert.equal(f.calls.listen,0);assert.equal(f.calls.tour,0);
  assert.ok(f.calls.order.indexOf('soundscape:water')<f.calls.order.indexOf('year:2000'));
});

test('a newer soundscape draft survives a pending old year load and applies only on the next Check',async()=>{
  const f=setup();f.choose('accessibleSoundscape','water');f.choose('accessibleYear','1890');f.choose('accessiblePlace','b');
  const gate=f.holdNextYear();f.click('accessibleInspect');await settle();
  assert.deepEqual(f.calls.selectSoundscape,['water']);assert.equal(f.state.collection,'impacts');assert.equal(f.state.impact.id,'water');
  f.choose('accessibleYear','2000');f.choose('accessiblePlace','a');f.choose('accessibleSoundscape','oceans');const newer=f.selectedValues(),options=[...f.el('accessibleSoundscape').options];
  gate.resolve();await settle();
  assert.deepEqual(f.calls.selectSoundscape,['water']);assert.deepEqual(f.calls.inspectContext[0],{collection:'impacts',impact:'water',year:'1890',point:{placeId:'b'}});
  assert.deepEqual(f.selectedValues(),newer);assert.equal(f.document.activeElement,f.el('accessibleSoundscape'));
  f.el('accessibleSoundscape').options.forEach((option,index)=>assert.equal(option,options[index]));
  f.click('accessibleInspect');await settle();
  assert.deepEqual(f.calls.selectSoundscape,['water','oceans']);assert.deepEqual(f.calls.inspectContext[1],{collection:'impacts',impact:'oceans',year:'2000',point:{placeId:'a'}});
  assert.equal(f.calls.listen,0);assert.equal(f.calls.tour,0);
});

test('Check during loading cannot apply a pending soundscape before the current action finishes',async()=>{
  const f=setup();f.choose('accessibleSoundscape','water');f.choose('accessibleYear','1890');const gate=f.holdNextYear();f.click('accessibleInspect');await settle();
  f.choose('accessibleSoundscape','ice');f.click('accessibleInspect');await settle();
  assert.deepEqual(f.calls.selectSoundscape,['water']);assert.equal(f.state.impact.id,'water');assert.equal(f.el('accessibleSoundscape').value,'ice');
  gate.resolve();await settle();assert.equal(f.el('accessibleSoundscape').value,'ice');assert.equal(f.calls.inspect.length,1);
});

test('returning to geography restores the original-reference listening path, including a missing-data point',async()=>{
  const f=setup();f.choose('accessibleSoundscape','ice');f.click('accessibleInspect');await settle();
  f.choose('accessibleSoundscape','geography');f.click('accessibleInspect');await settle();assert.equal(f.state.collection,'geography');assert.equal(f.el('accessibleSoundscape').value,'geography');
  assert.equal(f.el('accessibleRow').options.length,16);assert.equal(f.el('accessibleColumn').options.length,32);
  // The separate original-reference control updates the public snapshot.
  f.state.original=true;f.state.selection.value=null;f.emit();
  assert.equal(f.el('accessibleListen').getAttribute('aria-disabled'),'false');assert.match(f.el('accessibleReading').textContent,/original reference can play without a heartbeat/i);
  f.click('accessibleListen');await settle();assert.equal(f.calls.listen,1);assert.equal(f.state.collection,'geography');
});
