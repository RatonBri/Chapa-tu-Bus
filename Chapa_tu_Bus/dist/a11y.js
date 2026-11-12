/* Chapa tu Bus · voz y accesibilidad. Se carga DESPUÉS de journey.js y amplía sus funciones. */
(()=>{
'use strict';
const KEY='chapa-a11y-v1';
const DEF={voice:true,rate:1,announce:true,vibrate:true,handsFree:false,big:false,contrast:false,calm:false,toasts:true,arrive:'08:00',margin:15};
let S;try{S={...DEF,...JSON.parse(localStorage.getItem(KEY))}}catch{S={...DEF}}
const saveS=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition,synth=window.speechSynthesis;
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:"“”()]/g,' ').replace(/\s+/g,' ').trim();
const ico=d=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const P={mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',spk:'M4 9v6h4l5 4V5L8 9ZM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',acc:'M12 4.2a.6.6 0 1 0 0 .01M5 8.5l7 1.5 7-1.5M12 10v4m0 0-3 6m3-6 3 6',pin:'M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0'};
const cv={src:'sim',key:null,idx:0,lastPage:null};
let last='',uid=0,rec=null,recMode='',listening=false,speaking=false,pending=null,panelOpen=false,log=[],interim='',opener=null;
const gps={on:false,id:null,lock:null,msg:'',kind:'',cand:-1,hits:0};

/* ---------- Preferencias ---------- */
function applyPrefs(){const c=document.documentElement.classList;c.toggle('a11y-big',!!S.big);c.toggle('a11y-contrast',!!S.contrast);c.toggle('a11y-calm',!!S.calm)}
function setPref(k,v){S[k]=v;saveS();applyPrefs();if(k==='handsFree'){v?startRec(false):stopRec();paintDock()}if(k==='voice'&&!v)synth?.cancel()}

/* ---------- Voz de salida ---------- */
const live=t=>{const el=document.getElementById('cv-live');if(el){el.textContent='';setTimeout(()=>el.textContent=t,40)}};
const voice=()=>{const v=synth?.getVoices()||[];return v.find(x=>x.lang.replace('_','-')==='es-PE')||v.find(x=>/^es[-_](MX|US|419|AR|CO|CL)/i.test(x.lang))||v.find(x=>/^es/i.test(x.lang))||null};
function chunks(t){const out=[];let cur='';for(const s of (t.match(/[^.!?:]+[.!?:]*\s*/g)||[t])){if((cur+' '+s).length>180&&cur){out.push(cur);cur=s}else cur=(cur+' '+s).trim()}if(cur)out.push(cur);return out}
function say(text,o={}){
  if(!o.toast){last=text;addLog('bot',text)}
  if((!S.voice&&!o.force)||!synth){if(!o.toast)live(text);o.then&&setTimeout(o.then,0);return}
  if(o.interrupt!==false)synth.cancel();
  const my=++uid,parts=chunks(text);
  parts.forEach((p,i)=>{const u=new SpeechSynthesisUtterance(p),v=voice();u.lang=v?.lang||'es-PE';if(v)u.voice=v;u.rate=S.rate;
    if(i===0)u.onstart=()=>{if(my===uid){speaking=true;pauseRec()}};
    if(i===parts.length-1){const end=()=>{if(my!==uid)return;speaking=false;resumeRec();o.then&&o.then()};u.onend=end;u.onerror=end}
    synth.speak(u)})
}
document.addEventListener('pointerdown',()=>{try{if(synth){const u=new SpeechSynthesisUtterance('');u.volume=0;synth.speak(u)}}catch{}},{once:true});

/* ---------- Reconocimiento de voz ---------- */
function startRec(oneShot){
  if(!SR)return false;stopRec();
  const r=new SR();rec=r;recMode=oneShot?'one':'free';r.lang='es-PE';r.interimResults=true;r.continuous=!oneShot;r.maxAlternatives=1;
  r.onstart=()=>{if(r===rec){listening=true;paintPanel();paintDock()}};
  r.onresult=e=>{if(r!==rec)return;for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i],t=res[0].transcript;if(res.isFinal){interim='';utterance(t,oneShot)}else{interim=t;paintPanel()}}};
  r.onerror=e=>{if(r!==rec)return;listening=false;
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){S.handsFree=false;saveS();rec=null;say('No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador, o escribe tu orden.')}
    else if(e.error==='no-speech'&&oneShot)say('No te escuché. Toca el micrófono e inténtalo otra vez.');
    else if(e.error==='network')say('El reconocimiento de voz necesita internet. Puedes escribir tu orden.');
    else if(e.error==='audio-capture')say('No encuentro un micrófono disponible.')};
  r.onend=()=>{if(r!==rec)return;rec=null;listening=false;interim='';paintPanel();paintDock();if(S.handsFree)resumeRec()};
  try{r.start();return true}catch{return false}
}
function stopRec(){const r=rec;rec=null;listening=false;try{r?.abort()}catch{}paintPanel();paintDock()}
const pauseRec=()=>{if(S.handsFree&&rec){const r=rec;rec=null;try{r.abort()}catch{}listening=false;paintDock()}};
const resumeRec=()=>{if(S.handsFree&&!rec&&!speaking)setTimeout(()=>{if(S.handsFree&&!rec&&!speaking)startRec(false)},300)};
function utterance(text,oneShot){
  const n=norm(text),m=n.match(/(?:oye |hola |ok )?chapa ?(?:tu|to|a)? ?bus\b ?(.*)$/);
  if(!oneShot&&!m)return;                       // manos libres: solo con la frase de activación
  if(!oneShot&&!m[1]){say('Dime.',{then:()=>startRec(true)});return}
  handle(oneShot?text:m[1]);
}

/* ---------- Intérprete de órdenes (puro, con pruebas) ---------- */
const NUM={una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12};
function parseTime(t){
  t=t.replace(/\b(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g,w=>NUM[w]);
  const m=t.match(/\blas?\s+(\d{1,2})(?:[:.\s]+(?:y\s+)?(\d{2}|media|cuarto))?\s*(?:horas)?\s*(de la manana|de la tarde|de la noche|de la madrugada|am|pm|a m|p m)?/);
  if(!m)return null;let h=+m[1],mi=m[2]==='media'?30:m[2]==='cuarto'?15:+(m[2]||0);const p=m[3]||'';
  if(h>23||mi>59)return null;
  if(/tarde|noche|^p/.test(p)&&h<12)h+=12;else if(/manana|madrugada|^a/.test(p)&&h===12)h=0;else if(!p&&h>=1&&h<=6)h+=12;
  return h*60+mi;
}
const hhmm=n=>{n=((Math.round(n)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
function parse(t){
  t=norm(t).replace(/^(?:oye |hola |ok )?chapa ?(?:tu|to|a)? ?bus\b ?/,'').trim();
  const has=r=>r.test(t);let m;
  if(!t)return {k:'empty'};
  if(has(/^(para|detente|callate|silencio|basta|cancela|cancelar|ya)$|\bdeja de hablar\b/))return {k:'stop'};
  if(has(/\b(ayuda|que puedes hacer|que sabes hacer|comandos)\b/))return {k:'help'};
  if(has(/\b(repite|repetir|otra vez|de nuevo)\b/))return {k:'repeat'};
  if(has(/\b(proxima|siguiente)\s+(estacion|parada)\b|\b(donde|cuando)\s+(me\s+)?bajo\b|\bcuantas?\s+(estaciones|paradas)\s+faltan?\b/))return {k:'next'};
  if(has(/\b(donde estoy|como va (mi )?viaje|estado (de|del) (mi )?viaje|cuanto falta)\b/))return {k:'status'};
  if(has(/\b(inicia|iniciar|empieza|empezar|comienza|comenzar)\b.*\b(viaje|ruta|recorrido)\b/))return {k:'start'};
  if(has(/\ba que hora (tengo que |debo |puedo )?(salir|salgo)\b|\bhora de salida\b/))return {k:'deadline',time:parseTime(t)};
  if((m=t.match(/\bhorarios?\b(?: del?| de la| de los)?\s*(.*)$/)))return {k:'schedule',q:m[1].trim()};
  if(has(/\b(avisos?|incidencias?|novedades|alertas?|cierres?)\b/))return {k:'notices'};
  if(has(/\b(saldo|cuanto (dinero )?tengo)\b/))return {k:'balance'};
  if(has(/\b(lee|leer|leeme)\b.*\b(pantalla|pagina|todo|opciones)\b|\bque hay en (la )?pantalla\b/))return {k:'read'};
  if(has(/\b(accesibilidad|configuracion|ajustes)\b/))return {k:'settings'};
  if((m=t.match(/\b(?:abre|abrir|ir|ve|vamos|muestrame|llevame)\s+(?:a |al |a la )?(inicio|planificar|mi viaje|tutoriales|perfil|rutas|horarios)\b/)))return {k:'goto',page:m[1]};
  if(has(/\b(como llego|como voy|como ir|como puedo (llegar|ir)|quiero (ir|llegar)|llevame|ruta|voy a|necesito (ir|llegar))\b/)||/^(de|desde)\s/.test(t)){
    const time=parseTime(t),body=t.replace(/\s+(?:para llegar )?a (?:las\s+(?:\d|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)|la\s+(?:\d|una))\b.*$/,'').replace(/\s+para llegar$/,'');let from=null,to=null,mm;
    if((mm=body.match(/\bdesde\s+(.+?)\s+(?:hasta|a|al|hacia)\s+(?:la\s+|el\s+)?(.+)$/))||((/^de\s|\b(?:llego|voy|ir|ruta)\s+de\s/.test(body))&&(mm=body.match(/\bde\s+(.+?)\s+(?:hasta|a|al|hacia)\s+(?:la\s+|el\s+)?(.+)$/))))[from,to]=[mm[1],mm[2]];
    else if((mm=body.match(/\b(?:a|al|hasta|hacia)\s+(?:la\s+|el\s+)?(.+?)(?:\s+desde\s+(.+))?$/))){to=mm[1];from=mm[2]||null}
    if(to)return {k:'route',from,to,time};
  }
  return {k:'unknown'};
}

/* ---------- Lugares ---------- */
function lev(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
function stationMatch(q){
  q=norm(q).replace(/^(la |el |las |los )?(estacion|parada|paradero)\s+(de |del )?/,'').replace(/^(la |el )/,'');if(!q)return null;
  const N=Object.keys(STATION_GEO).map(n=>[n,norm(n)]);
  let hit=N.find(([,k])=>k===q)||(q.length>=3&&N.filter(([,k])=>k.startsWith(q)).length===1&&N.find(([,k])=>k.startsWith(q)));
  if(!hit){let best=null,bd=99;for(const [n,k] of N){const d=lev(k,q),lim=k.length<=5?1:k.length<=9?2:3;if(d<=lim&&d<bd){bd=d;best=[n]}}hit=best}
  return hit?{name:hit[0],coords:STATION_GEO[hit[0]],detail:'Estación del Metropolitano · punto de referencia OSM'}:null;
}
const geoCache=new Map();
async function geocode(q){
  if(geoCache.has(q))return geoCache.get(q);
  const url=new URL(MAP_CONFIG.search),ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),10000);
  url.search=new URLSearchParams({q,lat:'-12.05',lon:'-77.04',bbox:'-77.2,-12.3,-76.8,-11.8',limit:'3'});
  try{const res=await fetch(url,{signal:ctl.signal});if(!res.ok)return null;
    const f=((await res.json()).features||[]).find(f=>f.geometry?.type==='Point'&&f.geometry.coordinates[0]>=-77.2&&f.geometry.coordinates[0]<=-76.8&&f.geometry.coordinates[1]>=-12.3&&f.geometry.coordinates[1]<=-11.8);
    if(!f)return null;const p=f.properties,out={name:p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||q,coords:[f.geometry.coordinates[1],f.geometry.coordinates[0]],detail:[p.street,p.district||p.city].filter(Boolean).join(', ')};geoCache.set(q,out);return out}
  catch{return null}finally{clearTimeout(to)}
}
const getPos=()=>new Promise((ok,no)=>{if(!navigator.geolocation||!window.isSecureContext)return no(new Error('nogeo'));navigator.geolocation.getCurrentPosition(ok,no,{enableHighAccuracy:true,timeout:12000,maximumAge:30000})});
async function resolvePlace(q){
  if(/^(mi ubicacion|donde estoy|aqui|mi posicion)$/.test(norm(q))){
    try{const p=await getPos(),c=p.coords;if(c.latitude<-12.3||c.latitude>-11.8||c.longitude<-77.2||c.longitude>-76.8)return {err:'Tu ubicación está fuera de Lima y Callao.'};
      return {name:'Tu ubicación',coords:[c.latitude,c.longitude],detail:'Precisión ±'+Math.round(c.accuracy)+' m',acc:c.accuracy}}
    catch{return {err:'No pude obtener tu ubicación. Revisa el permiso de ubicación o dime una estación de origen.'}}
  }
  return stationMatch(q)||await geocode(q);
}

/* ---------- Descripciones habladas ---------- */
const dist=k=>k<1?Math.max(10,Math.round(k*100)*10)+' metros':k.toFixed(1).replace('.',',')+' kilómetros';
function describeRoute(r,i){
  const legs=r.legs.map((l,j)=>`${j?'luego ':''}toma el ${l.name} en ${l.from}, hacia ${l.towards}, y baja en ${l.to}, a ${l.stops.length-1} paradas`).join(', ');
  const walk=r.walkFrom!==undefined?` Caminas unos ${dist(r.walkFrom)} hasta ${r.origin} y ${dist(r.walkTo)} desde ${r.destination} a tu destino, en línea recta.`:'';
  return `Opción ${i+1}: ${legs}. ${r.transfers?'Hay '+r.transfers+' transbordo.':'Es directo, sin transbordos.'}${walk} Tiempo de referencia: unos ${r.duration} minutos, sin datos de tráfico en vivo.`;
}
function tripText(){
  const r=data.active;if(!r?.legs)return 'No tienes un viaje en curso. Planifica una ruta y di: inicia el viaje.';
  const {stops,index,progress}=progressState(r),how=cv.src==='gps'?'según tu ubicación':'avance simulado',left=stops.length-1-index;
  if(progress===1)return `Llegaste a ${stops.at(-1).name}. Puedes terminar tu viaje.`;
  return `${how}. Última estación: ${stops[index].name}. Siguiente: ${stops[index+1].name}. Faltan ${left} ${left===1?'parada':'paradas'} hasta tu destino, ${stops.at(-1).name}.${stops[index].transfer?' Aquí cambias a '+stops[index].transfer+'.':''}`;
}
function scheduleText(r,dir){
  const s=r.schedules[dir]||[],f=x=>x?String(x).replace(/–/g,' a '):'no proporcionado';
  return `${r.name}, de ${r[dir][0]} a ${r[dir].at(-1)}, ${r[dir].length} paradas. Lunes a viernes: ${f(s[0])}. Sábado: ${f(s[1])}. Domingo: ${f(s[2])}. Es el horario de operación; no indica a qué hora llegará un bus a tu parada.`;
}
function pageText(){
  if(page==='trip'&&data.active?.legs)return tripText();
  if(page==='plan'&&mapOptions?.length)return `Tienes ${mapOptions.length} opciones. `+mapOptions.map(describeRoute).join(' ');
  if(page==='live'){const r=routeSelected();return scheduleText(r,liveDirection)}
  const el=document.querySelector('#app').cloneNode(true);el.querySelectorAll('svg,script,style,.leaflet-container,[hidden]').forEach(n=>n.remove());
  const t=el.innerText||el.textContent||'';return t.replace(/\n+/g,'. ').replace(/\s+/g,' ').slice(0,1500);
}
function leaveInfo(r,time,margin){const walk=Math.round(((r.walkFrom||0)+(r.walkTo||0))/4.5*60),total=r.duration+walk+margin;return {leave:time-total,walk,total}}

/* ---------- Órdenes ---------- */
async function handle(raw){
  addLog('me',raw);
  try{
    if(pending){const p=pending,cmd=parse(raw);pending=null;
      if(cmd.k==='stop'){synth?.cancel();return}
      if(cmd.k==='unknown')return routeByVoice({fromQ:norm(raw).replace(/^(desde|de|en)\s+/,''),toPlace:p.to,time:p.time})}
    await exec(parse(raw),raw);
  }catch(e){console.error(e);say('Tuve un problema con esa orden. Inténtalo otra vez o escríbela.')}
}
async function exec(c,raw){
  switch(c.k){
    case 'empty':return say('Dime qué necesitas. Por ejemplo: cómo llego a la Estación Central.');
    case 'stop':return synth?.cancel();
    case 'repeat':return say(last||'Aún no he dicho nada.');
    case 'help':return say('Puedes decir: cómo llego a la Estación Central. Cómo llego de Naranjal a Angamos. Cuál es mi próxima estación. Lee los avisos. Horario del Regular B. A qué hora salgo para llegar a las ocho. Inicia el viaje. Lee la pantalla. Repite. O para, para callarme.');
    case 'next':case 'status':return say(tripText());
    case 'start':return startByVoice();
    case 'schedule':{const q=c.q,r=TRANSIT_CATALOG.find(x=>q&&(norm(x.name)===q||norm(x.name).replace(/^regular /,'')===q||norm(x.name).includes(q)||q.includes(norm(x.name))))||routeSelected();
      liveRouteId=r.id;liveDirection='south';liveStation=r.south[0];simProgress=0;go('live');return say(scheduleText(r,'south')+' Para el otro sentido, ábrelo en pantalla.')}
    case 'notices':{const d=new DOMParser().parseFromString(notices(),'text/html'),t=[...d.querySelectorAll('section.card')].map(s=>`${s.querySelector('.pill').textContent}. ${s.querySelector('h2').textContent}. ${s.querySelector('p').textContent}`);return say(t.length?'Avisos de demostración. '+t.join(' '):'No tienes avisos sin leer.')}
    case 'balance':return say(`Tu tarjeta ${card().name} tiene ${money(card().balance).replace('S/ ','')} soles de saldo de demostración.`);
    case 'read':return say(pageText());
    case 'settings':closePanel();return openSettings();
    case 'goto':{const m={inicio:'home',planificar:'plan','mi viaje':'trip',tutoriales:'tutorials',perfil:'profile',rutas:'live',horarios:'live'};go(m[c.page]);return say('Abrí '+c.page+'.')}
    case 'deadline':return deadlineByVoice(c.time);
    case 'route':return routeByVoice({fromQ:c.from,toQ:c.to,time:c.time});
    default:return say(`No entendí «${raw}». Prueba con: cómo llego a la Estación Central. O di: ayuda.`);
  }
}
async function routeByVoice({fromQ,toQ,toPlace,time}){
  const to=toPlace||await resolvePlace(toQ);
  if(!to||to.err)return say(to?.err||`No encontré «${toQ}». Prueba con el nombre de una estación o añade el distrito.`);
  let from=null,usedPrev=false;
  if(fromQ){from=await resolvePlace(fromQ);if(!from||from.err)return say(from?.err||`No encontré «${fromQ}» como origen. Prueba con otra estación o di: desde mi ubicación.`)}
  else if(places.from){from=places.from;usedPrev=true}
  else{pending={to,time};return say(`Voy a ${to.name}. ¿Desde dónde sales? Di, por ejemplo, desde Naranjal, o desde mi ubicación.`,{then:()=>{if(panelOpen)startRec(true)}})}
  places.from=from;places.to=to;queries.from=from.name;queries.to=to.name;planMode='map';
  if(page!=='plan')go('plan');
  calculateMapRoutes();
  if(!mapOptions.length)return say(searchMessage||'No encontré un recorrido entre esos puntos en el catálogo del Metropolitano. Prueba en Por paradas para los corredores.');
  let txt=`De ${from.name} a ${to.name}. ${usedPrev?'Usé como origen el último punto que elegiste. ':''}${describeRoute(mapOptions[0],0)}`;
  if(mapOptions.length>1)txt+=` Hay ${mapOptions.length-1} ${mapOptions.length===2?'alternativa más':'alternativas más'} en pantalla.`;
  if(time!=null){const li=leaveInfo(mapOptions[0],time,S.margin);S.arrive=hhmm(time);saveS();txt+=` Para llegar a las ${hhmm(time)}, sal a más tardar a las ${hhmm(li.leave)}: ${mapOptions[0].duration} minutos de viaje, ${li.walk} caminando y ${S.margin} de colchón por esperas.`}
  txt+=' Di: inicia el viaje, para seguirlo.';say(txt);
}
function deadlineByVoice(time){
  const r=mapOptions?.[mapChoice];if(!r)return say('Primero dime a dónde vas. Por ejemplo: cómo llego a la Estación Central.');
  if(time==null)return say('No entendí la hora. Di, por ejemplo: a qué hora salgo para llegar a las ocho de la mañana.');
  const li=leaveInfo(r,time,S.margin);S.arrive=hhmm(time);saveS();
  say(`Para llegar a las ${hhmm(time)}, sal a más tardar a las ${hhmm(li.leave)}. Son ${r.duration} minutos de viaje de referencia, ${li.walk} caminando y ${S.margin} de colchón por esperas. Son estimaciones sin datos en vivo; si puedes, sal antes.`);paintBlocks();
}
function startByVoice(){
  if(data.active)return(go('trip'),say('Ya tienes un viaje en curso. '+tripText()));
  const r=mapOptions?.length?mapOptions[mapChoice]:lastRoute;if(!r?.legs)return say('Primero dime a dónde quieres ir.');
  lastRoute=r;const cost=fare()*r.legs.length;
  if(card().balance<cost)return say(`Tu saldo de demostración, ${money(card().balance)}, no alcanza para este viaje, que cuesta ${money(cost)}. Puedes recargar desde el perfil.`);
  go('trip');startTrip();if(!data.active)say('No pude iniciar el viaje.');
}

/* ---------- Avisos del viaje ---------- */
function announceStart(){
  const r=data.active;if(!r?.legs)return;const {stops}=progressState(r);cv.key=r.id;cv.idx=0;
  say(`Viaje iniciado. Se registró un pasaje simulado de ${money(r.cost).replace('S/ ','')} soles. Subes en ${stops[0].name}, ${stops[0].line}. Tu destino es ${stops.at(-1).name}, a ${stops.length-1} paradas. ${cv.src==='gps'?'':'Los avisos son una simulación sin GPS; puedes activar los avisos por ubicación.'}`);
}
function announceProgress(){
  const r=data.active;if(!r?.legs||!document.getElementById('journey-status'))return;
  const {stops,index,progress}=progressState(r);
  if(cv.key!==r.id){cv.key=r.id;cv.idx=index;return}
  if(index<=cv.idx)return;
  cv.idx=index;const pre=cv.src==='gps'?'':'Simulación. ',s=stops[index];let t;
  if(progress===1)t=`Llegaste a ${s.name}, tu destino. Puedes terminar el viaje.`;
  else if(index===stops.length-2)t=`Tu estación de destino, ${stops.at(-1).name}, es la siguiente. Prepárate para bajar.`;
  else if(s.transfer)t=`Estás en ${s.name}. Cambia a ${s.transfer}. Siguiente parada: ${stops[index+1].name}.`;
  else{const left=stops.length-1-index;t=`Estación ${s.name}. Siguiente: ${stops[index+1].name}. Faltan ${left} paradas.`}
  if(S.announce)say(pre+t);else live(pre+t);
  if(S.vibrate&&navigator.vibrate&&(progress===1||index===stops.length-2))navigator.vibrate([400,200,400]);
}

/* ---------- GPS opcional y honesto ---------- */
const GPS_MAX_ACC=60;
function gpsMsg(kind,text){const first=gps.kind!==kind;gps.kind=kind;gps.msg=text;const el=document.getElementById('cv-gps-status');if(el)el.textContent=text;
  if(first&&kind==='weak')say('La señal de ubicación no es lo bastante confiable. No daré avisos por GPS hasta que mejore.');}
function gpsToggle(){gps.on?gpsStop():gpsStart()}
function gpsStart(){
  if(!data.active?.legs)return;
  if(!navigator.geolocation||!window.isSecureContext){gps.msg='La ubicación solo funciona con HTTPS o en localhost.';paintBlocks();return say(gps.msg)}
  journeyRunning=false;gps.on=true;cv.src='gps';gps.cand=-1;gps.hits=0;gpsMsg('wait','Buscando señal de ubicación…');
  gps.id=navigator.geolocation.watchPosition(onPos,e=>{gpsMsg('err',e.code===1?'Permiso de ubicación denegado. Sigues con el avance simulado.':'No hay señal de ubicación ahora.');if(e.code===1)gpsStop()},{enableHighAccuracy:true,maximumAge:3000,timeout:20000});
  try{navigator.wakeLock?.request('screen').then(l=>gps.lock=l).catch(()=>{})}catch{}
  render();say('Avisos por ubicación activados. Mantén la pantalla encendida para mejores resultados.');
}
function gpsStop(){if(gps.id!=null)navigator.geolocation.clearWatch(gps.id);gps.id=null;try{gps.lock?.release()}catch{}gps.lock=null;gps.on=false;cv.src='sim';gps.kind='';if(page==='trip')render()}
function onPos(pos){
  const r=data.active;if(!r?.legs)return gpsStop();
  const {latitude:la,longitude:lo,accuracy:acc}=pos.coords,stops=journeyStops(r);
  if(acc>GPS_MAX_ACC)return gpsMsg('weak',`Señal poco confiable (±${Math.round(acc)} m). Sin avisos por ubicación por ahora.`);
  let best=-1,bd=1e9;stops.forEach((s,i)=>{const c=STATION_GEO[s.name];if(!c)return;const d=distanceKm([la,lo],c)*1000;if(d<bd){bd=d;best=i}});
  const cur=progressState(r).index,lim=Math.max(100,acc*1.5);
  if(best<0||bd>lim){gps.cand=-1;gps.hits=0;return gpsMsg('ok',`Ubicación ±${Math.round(acc)} m. Aún no estás cerca de una estación de tu trayecto.`)}
  gpsMsg('ok',`Cerca de ${stops[best].name} (≈${Math.round(bd)} m, precisión ±${Math.round(acc)} m).`);
  if(best<=cur)return;
  gps.hits=best===gps.cand?gps.hits+1:1;gps.cand=best;
  if(gps.hits>=2){r.progress=best/(stops.length-1);save();paintJourney()}   // dos lecturas seguidas: evita saltos por ruido
}

/* ---------- Paneles y DOM ---------- */
function addLog(who,text){log.push({who,text});log=log.slice(-8);paintPanel()}
function buildDock(){
  document.body.insertAdjacentHTML('beforeend',`<div id="cv-live" class="sr-only" role="status" aria-live="polite"></div>
<div id="cv-dock" role="group" aria-label="Voz y accesibilidad"><button id="cv-mic" class="cv-fab main" aria-label="Hablar con Chapa tu Bus: dar una orden por voz" onclick="cv.open(true)">${ico(P.mic)}</button><button class="cv-fab" aria-label="Leer en voz alta esta pantalla" onclick="cv.read()">${ico(P.spk)}</button><button class="cv-fab" aria-label="Ajustes de voz y accesibilidad" onclick="cv.settings()">${ico(P.acc)}</button></div>
<section id="cv-panel" role="dialog" aria-label="Asistente de voz de Chapa tu Bus" hidden>
<div class="cv-head"><h2>Asistente de voz</h2><button class="icon-btn" aria-label="Cerrar asistente" onclick="cv.close()">${ico('m6 6 12 12M6 18 18 6')}</button></div>
<div class="cv-body"><button id="cv-listen" class="cv-listen" onclick="cv.listen()"></button><div id="cv-state" role="status" aria-live="polite"></div><div id="cv-interim" aria-hidden="true"></div>
<div id="cv-log" role="log" aria-label="Conversación"></div>
<div class="cv-row"><input id="cv-text" aria-label="Escribe tu pregunta" placeholder="O escribe: ¿cómo llego a Angamos?" autocomplete="off" onkeydown="if(event.key==='Enter')cv.send()"><button class="secondary" onclick="cv.send()">Enviar</button></div>
<div class="cv-chips" role="group" aria-label="Ejemplos"><button onclick="cv.ask('¿Cómo llego a la Estación Central?')">¿Cómo llego a la Estación Central?</button><button onclick="cv.ask('¿Cuál es mi próxima estación?')">¿Mi próxima estación?</button><button onclick="cv.ask('Lee los avisos')">Lee los avisos</button><button onclick="cv.ask('Horario del Regular B')">Horario del Regular B</button><button onclick="cv.ask('Ayuda')">Ayuda</button></div></div></section>`);
  paintDock();paintPanel();
}
function paintDock(){const b=document.getElementById('cv-mic');if(!b)return;b.classList.toggle('on',listening);b.querySelector('.cv-dot')?.remove();if(S.handsFree){b.insertAdjacentHTML('beforeend','<span class="cv-dot" aria-hidden="true"></span>');b.setAttribute('aria-label','Hablar con Chapa tu Bus. Modo manos libres activado')}else b.setAttribute('aria-label','Hablar con Chapa tu Bus: dar una orden por voz')}
function paintPanel(){
  const p=document.getElementById('cv-panel');if(!p)return;p.hidden=!panelOpen;if(!panelOpen)return;
  const l=document.getElementById('cv-listen');l.classList.toggle('on',listening);l.innerHTML=ico(P.mic)+(listening?'Escuchando… toca para detener':SR?'Toca y habla':'Micrófono no disponible: escribe');
  document.getElementById('cv-state').textContent=listening?'Escuchando…':speaking?'Hablando…':SR?'Listo. Di: «Chapa tu Bus, ¿cómo llego a…?»':'Este navegador no ofrece reconocimiento de voz. Puedes escribir tus órdenes.';
  document.getElementById('cv-interim').textContent=interim;
  document.getElementById('cv-log').innerHTML=log.map(m=>`<div class="cv-msg ${m.who}">${esc(m.text)}</div>`).join('');const lg=document.getElementById('cv-log');lg.scrollTop=lg.scrollHeight;
}
function openPanel(listen){opener=document.activeElement;panelOpen=true;paintPanel();if(listen){if(SR)listenNow();else document.getElementById('cv-text')?.focus();if(!log.length)addLog('bot','Hola. Pídeme una ruta, tu próxima estación, horarios o avisos.')}else document.getElementById('cv-listen')?.focus()}
function closePanel(){panelOpen=false;if(!S.handsFree)stopRec();synth?.cancel();paintPanel();opener?.focus?.()}
function listenNow(){synth?.cancel();speaking=false;if(listening){stopRec();return}if(!startRec(true))say('No pude activar el micrófono. Escribe tu orden.')}
function send(){const i=document.getElementById('cv-text'),v=i.value.trim();if(!v)return;i.value='';handle(v)}

function openSettings(){
  const sw=(k,t,d)=>`<label class="cv-setting"><span>${t}<small>${d}</small></span><input class="switch" type="checkbox" ${S[k]?'checked':''} onchange="cv.set('${k}',this.checked)"></label>`;
  modal(`<h2>Voz y accesibilidad</h2><p class="muted small">Pensado para TalkBack, VoiceOver y uso con una mano. Si usas un lector de pantalla puedes apagar la voz de la app: él leerá todo igualmente.</p>
${sw('voice','Voz de la app','Lee respuestas y avisos en voz alta')}
<div class="cv-setting"><label for="cv-rate" style="margin:0;color:var(--ink);font-size:14px">Velocidad de la voz</label><select id="cv-rate" onchange="cv.set('rate',Number(this.value))">${[[.8,'Lenta'],[1,'Normal'],[1.2,'Rápida'],[1.4,'Muy rápida']].map(([v,n])=>`<option value="${v}" ${S.rate===v?'selected':''}>${n}</option>`).join('')}</select></div>
${sw('announce','Avisos de estación hablados','«Tu estación de destino es la siguiente»')}
${sw('vibrate','Vibración al acercarte al destino','Solo en celulares que lo permiten (no iPhone)')}
${sw('handsFree','Manos libres («Chapa tu Bus…»)','Escucha mientras la app está abierta. Gasta más batería')}
${sw('big','Texto más grande','Amplía toda la interfaz')}
${sw('contrast','Alto contraste','Bordes y textos más marcados')}
${sw('calm','Reducir movimiento','Sin animaciones')}
<button class="secondary full spaced" onclick="cv.say('Hola, soy Chapa tu Bus. Así sonará mi voz.',true)">${ico(P.spk)} Probar voz</button>`);
}

/* ---------- Bloques inyectados tras cada render ---------- */
function deadlineBlock(){
  return `<section class="cv-block" id="cv-deadline"><h3>⏰ ¿A qué hora debes llegar?</h3><p class="small muted">Calcula a qué hora salir con esperas e imprevistos. Usa tiempos de referencia, no datos en vivo.</p>
<label for="cv-arrive">Hora de llegada</label><input id="cv-arrive" type="time" value="${S.arrive}" onchange="cv.set('arrive',this.value||'08:00',true)">
<label for="cv-margin">Colchón por esperas e imprevistos</label><select id="cv-margin" onchange="cv.set('margin',Number(this.value),true)">${[5,10,15,20,30].map(n=>`<option value="${n}" ${S.margin===n?'selected':''}>${n} minutos</option>`).join('')}</select>
<button class="primary full spaced" onclick="cv.deadline()">Calcular hora de salida</button><p id="cv-deadline-out" class="cv-out" role="status" aria-live="polite"></p></section>`;
}
function calcDeadline(){
  const r=mapOptions?.[mapChoice];if(!r)return;const [h,m]=(document.getElementById('cv-arrive').value||'08:00').split(':').map(Number),li=leaveInfo(r,h*60+m,S.margin),
  t=`Sal a más tardar a las ${hhmm(li.leave)} para llegar a las ${hhmm(h*60+m)}. Viaje de referencia ${r.duration} min + ${li.walk} min a pie + ${S.margin} min de colchón.`;
  document.getElementById('cv-deadline-out').textContent=t;S.arrive=hhmm(h*60+m);saveS();say(t);
}
function paintBlocks(){
  const out=document.getElementById('cv-deadline-out');if(out&&mapOptions?.[mapChoice]){const [h,m]=S.arrive.split(':').map(Number),li=leaveInfo(mapOptions[mapChoice],h*60+m,S.margin);out.textContent=`Sal a más tardar a las ${hhmm(li.leave)} para llegar a las ${S.arrive}.`}
  const g=document.getElementById('cv-gps-status');if(g)g.textContent=gps.msg;
}
function focusSig(){const a=document.activeElement;if(!a||a===document.body)return null;const box=a.closest('#app,#sidebar,#bottom,#header');if(!box)return null;const L=[...box.querySelectorAll('button,a[href],input,select,textarea')];return {box:'#'+box.id,id:a.id,idx:L.indexOf(a),page}}
function enhance(sig,prev){
  const titleOf=typeof title==='function'?title(page):'';document.title=(titleOf?titleOf+' · ':'')+'Chapa tu Bus';
  document.querySelectorAll('.chip').forEach(c=>{if(!c.hasAttribute('aria-pressed')&&!c.closest('.map-toolbar'))c.setAttribute('aria-pressed',c.classList.contains('selected'))});
  document.querySelectorAll('.nav-item.active,#bottom .active').forEach(n=>n.setAttribute('aria-current','page'));
  document.querySelectorAll('#app label:not([for])').forEach((l,i)=>{const n=l.nextElementSibling;if(n&&/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)&&!l.querySelector('input')){if(!n.id)n.id='cvl'+i;l.setAttribute('for',n.id)}});
  const tr=document.querySelector('.progress-track');if(tr){tr.setAttribute('role','progressbar');tr.setAttribute('aria-label','Progreso del viaje');tr.setAttribute('aria-valuemin','0');tr.setAttribute('aria-valuemax','100')}
  document.querySelectorAll('.map-toolbar [data-pick]').forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('selected')));
  const ha=document.querySelector('.header-actions');if(ha&&!ha.querySelector('.cv-hdr'))ha.insertAdjacentHTML('afterbegin',`<button class="icon-btn cv-hdr" aria-label="Ajustes de voz y accesibilidad" onclick="cv.settings()">${ico(P.acc)}</button>`);
  if(page==='home'){const g=document.querySelector('.home-grid');if(g&&!document.querySelector('.voice-banner'))g.insertAdjacentHTML('beforebegin',`<button class="voice-banner" onclick="cv.open(true)"><span class="badge" aria-hidden="true">${ico(P.mic)}</span><span><strong>Pregúntale con tu voz</strong><span class="t">Di: «Chapa tu Bus, ¿cómo llego a la Estación Central?» y recibe indicaciones habladas.</span></span></button>`)}
  if(page==='plan'&&typeof planMode!=='undefined'&&planMode==='map'&&mapOptions?.length){const o=document.getElementById('map-options');if(o&&!o.querySelector('#cv-deadline'))o.insertAdjacentHTML('beforeend',deadlineBlock())}
  if(page==='trip'&&data.active?.legs){const s=document.querySelector('.journey-status');if(s&&!s.querySelector('.cv-gps'))s.insertAdjacentHTML('beforeend',`<div class="cv-gps"><button class="secondary full" aria-pressed="${gps.on}" onclick="cv.gps()">${ico(P.pin)} ${gps.on?'Desactivar':'Activar'} avisos por ubicación (GPS)</button><p id="cv-gps-status" class="small muted" role="status">${esc(gps.msg||'Opcional. Pide permiso de ubicación.')}</p><label class="row"><input class="switch" type="checkbox" ${S.announce?'checked':''} onchange="cv.set('announce',this.checked)"> Avisos hablados de cada estación</label><p class="small muted">Los avisos por GPS solo se dan con precisión de ±${GPS_MAX_ACC} m o mejor y dos lecturas seguidas cerca de la estación. Los puntos de las estaciones son de referencia, no las entradas. En el navegador, el seguimiento puede detenerse con la pantalla apagada.</p></div>`)}
  const first=cv.lastPage===null;
  if(!first&&prev!==page&&!panelOpen){const h=document.querySelector('#app h1,#app h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}live((titleOf||'Pantalla')+'.')}
  else if(sig&&sig.page===page){const box=document.querySelector(sig.box);if(box){let el=sig.id&&box.querySelector('#'+CSS.escape(sig.id));if(!el)el=[...box.querySelectorAll('button,a[href],input,select,textarea')][sig.idx];el?.focus({preventScroll:true})}}
  cv.lastPage=page;
}

/* ---------- Ampliaciones de funciones existentes ---------- */
const _hint=mapHint;mapHint=function(){_hint();document.querySelectorAll('.map-toolbar [data-pick]').forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('selected')))};
const _render=render;render=function(){const sig=focusSig(),prev=cv.lastPage;_render();enhance(sig,prev)};
const _paint=paintJourney;paintJourney=function(){_paint();const bar=document.querySelector('.progress-track');if(bar&&data.active)bar.setAttribute('aria-valuenow',Math.floor((data.active.progress||0)*100));announceProgress()};
const _start=startTrip;startTrip=function(){const was=!!data.active;_start();if(!was&&data.active)announceStart()};
const _end=finishTrip;finishTrip=function(){if(gps.on)gpsStop();_end()};
const _toast=toast;toast=function(t){_toast(t);if(S.toasts&&!panelOpen)say(t,{interrupt:false,toast:true})};
const _modal=modal;modal=function(h){opener=document.activeElement;_modal(h);const d=document.querySelector('#modal .dialog'),t=d?.querySelector('h2');if(t){t.id='cv-dlg';d.setAttribute('aria-labelledby','cv-dlg');d.removeAttribute('aria-label')}};
const _close=closeModal;closeModal=function(){const had=!!document.querySelector('#modal .dialog');_close();if(had)opener?.focus?.()};

window.cv={open:openPanel,close:closePanel,listen:listenNow,send,ask:t=>handle(t),read:()=>say(pageText()),settings:openSettings,set:(k,v,silent)=>{setPref(k,v);if(silent)paintBlocks()},say:t=>say(t,{force:true}),gps:gpsToggle,deadline:calcDeadline,parse,parseTime,stationMatch,describeRoute,leaveInfo,hhmm,_state:S,_last:()=>last};
buildDock();applyPrefs();
if(S.handsFree&&SR)startRec(false);
render();
})();
