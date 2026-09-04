import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
import fs from 'fs';

const topo = JSON.parse(fs.readFileSync('wa.json','utf8'));
const W = 1400;
const BOX = { type: 'Polygon', coordinates: [[[-128,-8],[-128,44],[-60,68],[10,74],[90,72],[150,62],[150,20],[150,-8],[10,-12],[-128,-8]]] };
const HOT = ['643','112','398','860','051','268','417','784','196','840'];
const CL = [
 ['Москва',37.62,55.75],['Санкт-Петербург',30.31,59.94],['Казань',49.11,55.79],['Екатеринбург',60.6,56.84],
 ['Новосибирск',82.93,55.03],['Краснодар',38.98,45.04],['Минск',27.56,53.9],['Алматы',76.89,43.24],
 ['Астана',71.43,51.13],['Ташкент',69.24,41.3],['Ереван',44.51,40.18],['Тбилиси',44.79,41.72],
 ['Бишкек',74.59,42.87],['Дубай',55.27,25.2],['Лимасол · Кипр',33.04,34.68],['Кремниевая долина',-122.14,37.44],
 ['Лос-Анджелес',-118.24,34.05],['Майами',-80.19,25.76],['Нью-Йорк',-74.01,40.71]
];

const feats = topojson.feature(topo, topo.objects.countries);
const proj = d3.geoNaturalEarth1().fitWidth(W, BOX);
// round output coords to 1 decimal to shrink the path data
const path = d3.geoPath(proj);
const b = path.bounds(BOX);
const y0 = b[0][1], H = Math.max(1, b[1][1]-y0);

function round(d, p=1){ return d.replace(/-?\d+\.\d+/g, m => (+(+m).toFixed(p)).toString()); }

let base='', hot='';
for (const f of feats.features) {
  const id = String(f.id);
  if (id === '010') continue;
  let p = path(f);
  if (p) p = round(p, 0);
  if (!p) continue;
  if (HOT.indexOf(id) >= 0) hot += p; else base += p;
}
const home = [CL[0][1], CL[0][2]];
const arcs = [];
for (let i=1;i<CL.length;i++){
  const ip = d3.geoInterpolate(home, [CL[i][1], CL[i][2]]);
  const pts = [];
  for (let t=0;t<=1.0001;t+=1/24) pts.push(ip(Math.min(1,t)));
  arcs.push(round(path({type:'LineString',coordinates:pts})||'',1));
}
const pins = CL.map(c => { const q = proj([c[1],c[2]]); return [ +((q[0]/W)*100).toFixed(3), +(((q[1]-y0)/H)*100).toFixed(3) ]; });

const out = {
  vb: `0 ${(+y0.toFixed(1))} ${W} ${(+H.toFixed(1))}`,
  base: round(base,1), hot: round(hot,1), arcs, pins
};
fs.writeFileSync('mapdata.json', JSON.stringify(out));
console.log('viewBox', out.vb);
console.log('base', out.base.length, 'hot', out.hot.length, 'arcs', arcs.join('').length, 'pins', pins.length);
console.log('total', JSON.stringify(out).length);
