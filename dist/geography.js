(function (root, factory) {
  'use strict';
  var countries = root && root.CLIMATE_COUNTRIES;
  if (typeof module === 'object' && module.exports) {
    countries = require('./assets/geocountries.js');
    module.exports = factory(countries);
  } else root.ClimateGeography = factory(countries);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dataset) {
  'use strict';
  // These are selected expressive references, never claims that one instrument
  // represents every culture in a region. Borders use present-day Natural Earth.
  var regions = [
    {id:'north-america',label:'Estados Unidos y Canadá',instrument:'Banjo',origin:'Referencia bluegrass de los Apalaches; raíces africanas y afroamericanas',source:'https://www.nps.gov/blri/learn/historyculture/the-banjo.htm'},
    {id:'mexico-central',label:'México y Centroamérica',instrument:'Marimba',origin:'Referencia compartida de Guatemala y Chiapas',source:'https://sic.cultura.gob.mx/ficha.php?table=frpintangible&table_id=182'},
    {id:'caribbean',label:'Caribe',instrument:'Steelpan',origin:'Referencia de Trinidad y Tobago',source:'https://foreign.gov.tt/about/trinidad-tobago/national-symbols/national-instrument/'},
    {id:'andes',label:'Sudamérica andina',instrument:'Quena y charango',origin:'Referencia instrumental de tradiciones andinas transfronterizas',source:'https://guides.loc.gov/indigenous-andes-folklife/music'},
    {id:'brazil',label:'Brasil y Sudamérica tropical atlántica',instrument:'Cavaquinho',origin:'Referencia brasileña de samba',source:'https://ich.unesco.org/en/RL/samba-de-roda-from-the-reconcavo-of-bahia-00101'},
    {id:'south-cone',label:'Cono Sur',instrument:'Bandoneón',origin:'Referencia del tango del Río de la Plata, Buenos Aires y Montevideo',source:'https://ich.unesco.org/en/RL/tango-00258'},
    {id:'europe',label:'Europa',instrument:'Violín y cuerdas de cámara',origin:'Referencia europea de concierto y tradición barroca',source:'https://www.metmuseum.org/fr/essays/renaissance-violins'},
    {id:'middle-east',label:'Norte de África y Asia occidental',instrument:'Oud',origin:'Referencia elegida entre tradiciones del norte de África y Asia occidental',source:'https://ich.unesco.org/en/decisions/17.COM/7.B.16'},
    {id:'west-africa',label:'África occidental y central',instrument:'Kora',origin:'Referencia mandé de África occidental',source:'https://www.metmuseum.org/art/collection/search/501115'},
    {id:'east-africa',label:'África oriental y austral',instrument:'Mbira',origin:'Referencia de tradiciones de Malawi y Zimbabue',source:'https://ich.unesco.org/en/decisions/15.COM/8.b.38'},
    {id:'central-asia',label:'Asia central',instrument:'Dombra',origin:'Referencia kazaja',source:'https://ich.unesco.org/en/Decisions/9.COM/10.23'},
    {id:'south-asia',label:'Asia meridional',instrument:'Sitar',origin:'Referencia principalmente del norte de India',source:'https://www.metmuseum.org/it/essays/musical-instruments-of-the-indian-subcontinent'},
    {id:'east-asia',label:'Asia oriental',instrument:'Erhu',origin:'Referencia china de cuerda frotada',source:'https://www.metmuseum.org/art/collection/search/500616'},
    {id:'southeast-asia',label:'Sudeste asiático',instrument:'Metalófonos y gongs',origin:'Referencia indonesia inspirada en gamelan, sin reproducir sus reglas completas',source:'https://ich.unesco.org/en/RL/gamelan-01607'},
    {id:'australasia',label:'Australia y Nueva Zelanda',instrument:'Didjeridú',origin:'Firma de entrada de referencia australiana; no representa las tradiciones de Nueva Zelanda',source:'https://aiatsis.gov.au/explore/didjeridu'},
    {id:'pacific',label:'Islas del Pacífico',instrument:'ʻUkulele',origin:'Referencia hawaiana',source:'https://www.americanhistory.si.edu/explore/stories/5-things-you-probably-didnt-know-about-ukulele'}
  ];
  var fallback = {id:'ocean',label:'Océano o zona sin asignación',instrument:'Síntesis neutra',origin:'Voz de contexto sin referencia cultural',source:'https://www.naturalearthdata.com/about/terms-of-use/'};
  var polar = {id:'polar',label:'Región polar',instrument:'Síntesis neutra',origin:'Voz de contexto sin referencia cultural',source:'https://www.naturalearthdata.com/about/terms-of-use/'};
  var centers={
    'north-america':[37,-81], 'mexico-central':[16.75,-92.63], 'caribbean':[10.5,-61.3],
    'andes':[-13.52,-71.97], 'brazil':[-15.79,-47.88], 'south-cone':[-34.6,-58.38],
    'europe':[45.44,12.33], 'middle-east':[33.32,44.36], 'west-africa':[12.64,-8],
    'east-africa':[-17.83,31.05], 'central-asia':[51.17,71.43], 'south-asia':[28.61,77.21],
    'east-asia':[39.9,116.4], 'southeast-asia':[-7.8,110.37], 'australasia':[-18,125],
    'pacific':[21.3,-157.8]
  };
  var byId = Object.create(null);
  regions.forEach(function(r){ var c=centers[r.id];r.center=Object.freeze({lat:c[0],lon:c[1]});byId[r.id]=Object.freeze(r); });
  Object.freeze(regions); Object.freeze(fallback); Object.freeze(polar);

  // Standard Robinson coefficients at 5-degree latitude intervals. We invert
  // the normalized map extent, not an equirectangular screen rectangle.
  var X=[1,.9986,.9954,.99,.9822,.973,.96,.9427,.9216,.8962,.8679,.835,.7986,.7597,.7186,.6732,.6213,.5722,.5322];
  var Y=[0,.062,.124,.186,.248,.31,.372,.434,.4958,.5571,.6176,.6769,.7346,.7903,.8435,.8936,.9394,.9761,1];
  function inverseRobinson(xNorm,yNorm) {
    if(!Number.isFinite(xNorm)||!Number.isFinite(yNorm)||xNorm<0||xNorm>1||yNorm<0||yNorm>1) return null;
    var yy=(.5-yNorm)*2, ay=Math.abs(yy), i=0;
    while(i<17 && Y[i+1]<ay) i++;
    var t=Math.min(1,Math.max(0,(ay-Y[i])/(Y[i+1]-Y[i])));
    var lat=(i+t)*5*(yy<0?-1:1);
    var scale=X[i]+(X[i+1]-X[i])*t;
    var lon=(xNorm-.5)*360/scale;
    if(Math.abs(lon)>180.000001) return null;
    return {lat:lat,lon:Math.max(-180,Math.min(180,lon))};
  }
  function forwardRobinson(lat,lon) {
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    var index=Math.min(17,Math.floor(Math.abs(lat)/5)),t=Math.abs(lat)/5-index;
    var xx=X[index]+(X[index+1]-X[index])*t,yy=Y[index]+(Y[index+1]-Y[index])*t;
    return {x:.5+lon/360*xx,y:.5-(lat<0?-1:1)*yy/2};
  }
  function ringContains(ring,lon,lat) {
    var inside=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      if((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  var polygons=[];
  (dataset&&dataset.countries||[]).forEach(function(country){
    country.polygons.forEach(function(rings){
      var west=180,east=-180,south=90,north=-90;
      rings[0].forEach(function(p){west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);});
      polygons.push({country:country,rings:rings,west:west,east:east,south:south,north:north});
    });
  });
  function countryAt(lat,lon) {
    for(var i=0;i<polygons.length;i++){
      var p=polygons[i];
      if(lon<p.west||lon>p.east||lat<p.south||lat>p.north||!ringContains(p.rings[0],lon,lat))continue;
      var hole=false;for(var j=1;j<p.rings.length;j++)if(ringContains(p.rings[j],lon,lat)){hole=true;break;}
      if(!hole)return p.country;
    }
    return null;
  }
  var groups={
    'north-america':['USA','CAN'],
    'mexico-central':['MEX','GTM','BLZ','HND','SLV','NIC','CRI','PAN'],
    'caribbean':['CUB','JAM','HTI','DOM','PRI','BHS','TTO'],
    'andes':['COL','ECU','PER','BOL'],
    'brazil':['BRA','GUY','SUR','VEN'],
    'south-cone':['ARG','URY','PRY','FLK'],
    'middle-east':['IRN','TUR','CYP','CYN','ARM','AZE','GEO'],
    'central-asia':['KAZ','UZB','TKM','KGZ','TJK'],
    'australasia':['AUS','NZL']
  };
  var countryRegion=Object.create(null);
  Object.keys(groups).forEach(function(key){groups[key].forEach(function(id){countryRegion[id]=key;});});
  function chooseRegion(country,lat,lon) {
    if(country.id==='GRL'||country.id==='ATA'||country.id==='ATF')return polar;
    if(country.id==='USA' && lat>15&&lat<26&&lon>-165&&lon<-150)return byId.pacific;
    if(country.id==='CHL')return byId[lat>-34?'andes':'south-cone'];
    if(country.id==='FRA'&&lat<10&&lon<-45)return byId.brazil;
    if(country.id==='RUS')return byId[lon<60?'europe':lon<100?'central-asia':'east-asia'];
    if(countryRegion[country.id])return byId[countryRegion[country.id]];
    if(country.continent==='Europe')return byId.europe;
    if(country.continent==='Africa')return byId[country.subregion==='Northern Africa'?'middle-east':(['Eastern Africa','Southern Africa'].includes(country.subregion)?'east-africa':'west-africa')];
    if(country.continent==='Asia')return byId[country.subregion==='Western Asia'?'middle-east':country.subregion==='Central Asia'?'central-asia':country.subregion==='Southern Asia'?'south-asia':country.subregion==='South-Eastern Asia'?'southeast-asia':'east-asia'];
    if(country.continent==='Oceania')return byId.pacific;
    if(country.continent==='South America')return byId.brazil;
    if(country.continent==='North America')return byId.caribbean;
    return fallback;
  }
  function regionAt(lat,lon) {
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)return null;
    lon=((lon+180)%360+360)%360-180;
    var country=countryAt(lat,lon),r=country?chooseRegion(country,lat,lon):Math.abs(lat)>75?polar:fallback;
    return Object.assign({},r,{country:country?country.name:null,countryId:country?country.id:null,lat:lat,lon:lon});
  }
  function atPixel(xNorm,yNorm) {
    var position=inverseRobinson(xNorm,yNorm);
    return position?regionAt(position.lat,position.lon):null;
  }
  return {regions:regions,inverseRobinson:inverseRobinson,forwardRobinson:forwardRobinson,regionAt:regionAt,atPixel:atPixel,
    countryAt:countryAt,source:dataset&&dataset.source,
    note:'Zonas de exploración aproximadas con fronteras actuales de Natural Earth 1:110m. Referencias instrumentales seleccionadas, no equivalencias culturales universales.'};
});
