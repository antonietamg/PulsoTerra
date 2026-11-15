"""Reduce Natural Earth public-domain country polygons for offline hit testing."""
from pathlib import Path
import urllib.request, json
ROOT = Path(__file__).resolve().parents[1]
url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
raw = urllib.request.urlopen(url, timeout=60).read()
(ROOT / 'sources' / 'natural-earth-countries-110m.geojson').write_bytes(raw)
data = json.loads(raw)
countries = []
for f in data['features']:
    p = f['properties']; geom = f['geometry']
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    reduced = [[[ [round(x,3),round(y,3)] for x,y,*_ in ring] for ring in poly] for poly in polys]
    countries.append({'id':p['ADM0_A3'],'name':p.get('NAME_ES') or p['ADMIN'],
        'continent':p['CONTINENT'],'subregion':p['SUBREGION'],'polygons':reduced})
result = {'source':url,'license':'Public domain','licenseUrl':'https://www.naturalearthdata.com/about/terms-of-use/',
    'resolution':'Natural Earth 1:110m; approximate coastlines; present-day boundaries', 'countries':countries}
payload = json.dumps(result,ensure_ascii=False,separators=(',',':'))
text = '(function(r){var d='+payload+';if(typeof module===\'object\'&&module.exports)module.exports=d;if(r)r.CLIMATE_COUNTRIES=d;})(typeof globalThis!==\'undefined\'?globalThis:this);\n'
(ROOT / 'dist' / 'assets' / 'geocountries.js').write_text(text,encoding='utf-8')
print('Wrote',len(countries),'countries;',len(text.encode()),'bytes')
