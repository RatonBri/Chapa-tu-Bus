const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=vm.createContext({});vm.runInContext(['catalog','routes','planner'].map(f=>fs.readFileSync(`dist/${f}.js`,'utf8')).join('\n'),c);
const run=s=>vm.runInContext(s,c);
assert.equal(run('TRANSIT_CATALOG.length'),12);
for(const [id,a,b] of [['301',46,41],['303',21,19],['201',46,46],['204',65,63],['404',45,44],['A',16,16],['C',24,24],['SX',6,3]]){
 assert.equal(run(`TRANSIT_CATALOG.find(r=>r.id==='${id}').south.length`),a);assert.equal(run(`TRANSIT_CATALOG.find(r=>r.id==='${id}').north.length`),b);
}
assert.equal(run("TRANSIT_CATALOG.find(r=>r.id==='EX1').north.includes('28 de Julio')"),false);
assert.equal(run("TRANSIT_CATALOG.find(r=>r.id==='SX').north[0]"),'Comunidad Andina / Aramburú');
assert.equal(run("TRANSIT_CATALOG.find(r=>r.id==='B').schedules.south[0]"),'10:00–23:00');
assert.equal(run("TRANSIT_CATALOG.find(r=>r.id==='EX1').schedules.north[1]"),'06:00–21:00');
assert.equal(run("TRANSIT_CATALOG.find(r=>r.id==='303').schedules.south[2]"),null);
assert.equal(run("findJourneys('Ramón Castilla','Matellini')[0].legs[0].routeId"),'C');
assert.ok(run("findJourneys('Naranjal','Matellini').length>0"));
run(`for(const a of metroStations)for(const b of metroStations)for(const j of findJourneys(a,b)){
 if(j.legs[0].from!==a||j.legs.at(-1).to!==b)throw Error('Bad endpoint');
 j.legs.forEach((l,i)=>{const r=TRANSIT_CATALOG.find(r=>r.id===l.routeId),ss=r[l.direction];if(JSON.stringify(ss.slice(l.startIndex,l.endIndex+1))!==JSON.stringify(l.stops))throw Error('Invalid segment');if(i&&j.legs[i-1].to!==l.from)throw Error('Disconnected transfer')});
}`);
run("planNetwork='azul';planService='301';planDirection='north'");
assert.equal(run("availablePlannerStations()[0]"),'El Sol (parada 1)');assert.equal(run("availablePlannerStations()[38]"),'El Sol (parada 39)');
assert.equal(run("findJourneys('El Sol (parada 39)','24 de Junio')[0].legs[0].startIndex"),38);
assert.equal(run("findJourneys('24 de Junio','El Sol (parada 1)').length"),0);
run("planNetwork='rojo';planService='204';planDirection='south'");
assert.equal(run("findJourneys('Huertos','Contisuyo')[0].legs[0].stops.length"),65);
assert.equal(run("findJourneys('Huertos','La Marina').length"),0);
for(const r of run('TRANSIT_CATALOG'))for(const name of Object.values(r.maps))assert.ok(fs.existsSync(`dist/maps/${name}.png`));
// Exercise payment against application state, including repeated start protection.
const dom={innerHTML:'',style:{},textContent:'',classList:{add(){},remove(){}},focus(){}};
const app=vm.createContext({document:{querySelector:()=>dom,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},window:{scrollTo(){},setTimeout(){return 0}},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},clearTimeout(){}});
vm.runInContext(['catalog','routes','planner','app'].map(f=>fs.readFileSync(`dist/${f}.js`,'utf8')).join('\n'),app);
vm.runInContext("lastRoute=findJourneys('Chimpu Ocllo','Matellini')[0];startTrip();startTrip()",app);
assert.equal(vm.runInContext('data.transactions.length',app),1);
assert.equal(vm.runInContext('data.cards[0].balance',app),21.30);
console.log('PASS: 12 services, counts, direction-specific schedules/stops, all Metro station pairs, duplicate stop names, maps, single payment');
