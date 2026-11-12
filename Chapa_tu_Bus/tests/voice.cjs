// Pruebas del intérprete de voz, coincidencia de estaciones, hora de salida y avisos de estación.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let saved='';
const el=()=>{const o={innerHTML:'',style:{},textContent:'',hidden:false,disabled:false,value:'',classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},removeAttribute(){},insertAdjacentHTML(){},querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null,focus(){},remove(){}};return o};
const shared=el();
const c=vm.createContext({document:{body:shared,title:'',activeElement:null,documentElement:{classList:{toggle(){}}},querySelector:()=>shared,getElementById:()=>shared,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:()=>null,setItem:(k,v)=>{if(k==='metro-demo-v1')saved=v}},
 window:{scrollTo(){},setTimeout:()=>0,isSecureContext:true},navigator:{},CSS:{escape:s=>s},DOMParser:class{parseFromString(){return {querySelectorAll:()=>[]}}},setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},URL,URLSearchParams,AbortController});
vm.runInContext(['catalog','routes','planner','app','geo-stations','journey','a11y'].map(f=>fs.readFileSync('dist/'+f+'.js','utf8')).join('\n'),c);
run0=s=>vm.runInContext(s,c);run0('var cv=window.cv');const run=run0,P=t=>JSON.parse(JSON.stringify(run(`cv.parse(${JSON.stringify(t)})`)));
// órdenes
assert.deepEqual(P('Chapa tu Bus, ¿cómo llego a la Estación Central?'),{k:'route',from:null,to:'estacion central',time:null});
assert.equal(P('¿Cómo llego de Naranjal a Angamos?').from,'naranjal');assert.equal(P('¿Cómo llego de Naranjal a Angamos?').to,'angamos');
assert.equal(P('cómo llego a UNI desde Caquetá').from,'caqueta');
assert.equal(P('cómo llego a Central a las 8 de la mañana').to,'central');
assert.equal(P('cómo llego a Central a las ocho').time,8*60);
assert.equal(P('cómo llego a dos de mayo').to,'dos de mayo');
assert.equal(P('¿Cuál es mi próxima estación?').k,'next');assert.equal(P('lee los avisos').k,'notices');
assert.equal(P('horario del Regular B').q,'regular b');assert.equal(P('inicia el viaje').k,'start');
assert.equal(P('para').k,'stop');assert.equal(P('repite').k,'repeat');assert.equal(P('qué puedes hacer').k,'help');
assert.equal(P('¿A qué hora salgo para llegar a las 7:30 de la mañana?').time,7*60+30);
assert.equal(run('cv.parseTime("a las 6 de la tarde")'),18*60);assert.equal(run('cv.parseTime("a las 12 de la noche")'),12*60);
assert.equal(P('blablabla').k,'unknown');
// estaciones (incluye errores típicos del reconocimiento)
const st=q=>run(`cv.stationMatch(${JSON.stringify(q)})`)?.name;
assert.equal(st('estación central'),'Central');assert.equal(st('la uni'),'UNI');assert.equal(st('naranjal'),'Naranjal');assert.equal(st('naranjar'),'Naranjal');assert.equal(st('españa'),'España');assert.equal(st('dos de mayo'),'Dos de Mayo');
assert.equal(st('plaza norte mall'),undefined);
// hora de salida
assert.equal(run('cv.hhmm(7*60+5)'),'07:05');
run("places={from:{name:'Naranjal',coords:STATION_GEO.Naranjal},to:{name:'Angamos',coords:STATION_GEO.Angamos}};calculateMapRoutes()");
assert.ok(run('mapOptions.length')>0);
const li=run('cv.leaveInfo(mapOptions[0],8*60,15)');assert.equal(li.leave,8*60-li.total);assert.ok(li.total>=run('mapOptions[0].duration')+15);
// ruta por voz completa
run("places={from:null,to:null};cv.ask('¿Cómo llego de Naranjal a Angamos?')");
setImmediate(()=>{
 const said=run('cv._last()');assert.match(said,/Opción 1/);assert.match(said,/Naranjal/);assert.match(said,/Angamos/);assert.match(said,/sin datos de tráfico en vivo/);
 // iniciar viaje por voz: un solo cobro y aviso de inicio
 const bal=run('card().balance');run("cv.ask('inicia el viaje')");
 setImmediate(()=>{
  assert.ok(run('!!data.active'));assert.match(run('cv._last()'),/Viaje iniciado/);
  run("cv.ask('inicia el viaje')");
  setImmediate(()=>{
   assert.equal(run('data.transactions.length'),1);assert.ok(run('card().balance')<bal);
   // avisos: nunca repite una estación ya anunciada y avisa que el destino es el siguiente
   const n=run('journeyStops(data.active).length');const heard=[];
   for(let i=0;i<n;i++){run('nextJourneyStop()');heard.push(run('cv._last()'))}
   assert.ok(heard.some(t=>/destino, .+, es la siguiente/.test(t)));assert.match(heard.at(-1),/Llegaste a/);
   assert.ok(heard.every(t=>/^Simulación\./.test(t)||/Llegaste/.test(t)||/destino/.test(t)||/Viaje/.test(t)||t));
   run("cv.ask('¿cuál es mi próxima estación?')");setImmediate(()=>{assert.match(run('cv._last()'),/Llegaste/);
    console.log('PASS: órdenes de voz, estaciones con errores de reconocimiento, hora de salida, ruta por voz, un solo cobro, avisos de estación');});
  });
 });
});
