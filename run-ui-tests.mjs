/* Funktionsprüfung mit einem kleinen DOM-Testmodell, kein visueller
   Browsertest. Prüft Start, Ereignisverdrahtung, Speicherung und Dialogabläufe.
   Aufruf: node run-ui-tests.mjs */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
let elements=[];
class Element {
  constructor(tag,attrs={}) {
    this.tagName=tag;this.attrs=attrs;this.dataset={};this.value=attrs.value||"";this.textContent="";this.hidden='hidden' in attrs;this.disabled='disabled' in attrs;
    this.open=false;this.listeners={};this.childNodes=[];this.customValidity="";
    this.classes=new Set((attrs.class||"").split(/\s+/).filter(Boolean));
    this.classList={contains:c=>this.classes.has(c),add:(...cs)=>cs.forEach(c=>this.classes.add(c)),remove:(...cs)=>cs.forEach(c=>this.classes.delete(c)),toggle:(c,v)=>{const on=v===undefined?!this.classes.has(c):v;if(on)this.classes.add(c);else this.classes.delete(c);return on;}};
    this.style={setProperty:(k,v)=>{this.style[k]=String(v);}};
    Object.keys(attrs).filter(k=>k.startsWith('data-')).forEach(k=>{this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=decode(attrs[k]);});
  }
  set innerHTML(text){this._html=text;this.childNodes=parse(text);}
  get innerHTML(){return this._html||"";}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatch(type,event={}){(this.listeners[type]||[]).forEach(fn=>fn({target:this,preventDefault(){},...event}));}
  setAttribute(k,v){this.attrs[k]=String(v);}
  removeAttribute(k){delete this.attrs[k];}
  setCustomValidity(text){this.customValidity=text;}
  reportValidity(){return !this.customValidity;}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;this.attrs.open="";}
  close(){this.open=false;delete this.attrs.open;this.dispatch('close');}
  querySelectorAll(selector){return descendants(this.childNodes).filter(e=>matches(e,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  appendChild(child){this.childNodes.push(child);}
  remove(){}
  click(){this.dispatch('click');}
}
function parse(text){
  return [...String(text).matchAll(/<([a-z][\w-]*)(\s[^>]*|)>/gi)].map(m=>{
    const attrs={};for(const a of m[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??"");
    return new Element(m[1].toLowerCase(),attrs);
  });
}
function descendants(nodes){return nodes.flatMap(e=>[e,...descendants(e.childNodes)]);}
function matches(e,selector){
  if(selector.startsWith('.'))return e.classes.has(selector.slice(1));
  const m=selector.match(/^(\w+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if(m)return (!m[1]||e.tagName===m[1])&&(m[2] in e.attrs)&&(m[3]===undefined||e.attrs[m[2]]===m[3]);
  return e.tagName===selector;
}
elements=parse(html);
const document={getElementById:id=>descendants(elements).find(e=>e.attrs.id===id)||null,querySelectorAll:selector=>descendants(elements).filter(e=>matches(e,selector)),querySelector:selector=>document.querySelectorAll(selector)[0]||null,addEventListener(){},createElement:tag=>new Element(tag),body:new Element('body'),documentElement:new Element('html'),activeElement:null};
const data=new Map();
const localStorage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),clear:()=>data.clear()};
const alerts=[];
const context={console,Date,Intl,Math,JSON,Object,Array,Number,String,Boolean,Set,Map,isNaN,parseInt,parseFloat,document,localStorage,navigator:{},
 window:{scrollTo(){},addEventListener(){},innerHeight:844,scrollY:0,visualViewport:null},setTimeout(){return 0;},clearTimeout(){},alert:text=>alerts.push(text),confirm:()=>true,
 URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},Blob:class{constructor(parts){this.parts=parts;}},
 FileReader:class{readAsText(file){this.result=file.contents;this.onload();}}};
vm.createContext(context);vm.runInContext(source,context);
const evaluate=code=>vm.runInContext(code,context), app=context, byId=id=>document.getElementById(id);
let count=0;
function check(name,condition){if(!condition)throw new Error(name);console.log(`✓ ${name}`);count++;}
const submit=id=>byId(id).dispatch('submit');
const click=id=>byId(id).click();
const query=(selector,fn)=>document.querySelectorAll(selector).find(fn);
app.init();
const day=app.todayISO();
check('App startet ohne fehlende Elemente',byId('appVersionLabel').textContent==='Ensembly 6.4.2');
check('Der leere Tag bleibt offen',byId('roleHeroName').textContent===''&&byId('rolePickerWrap').hidden);
check('Fünf Check-ins sind bedienbar',byId('checkinSlots').querySelectorAll('[data-open-checkin-slot]').length===5);
query('[data-open-checkin-slot]',e=>e.dataset.openCheckinSlot==='morning').click();
check('Morgen-Check-in öffnet den Dialog',byId('stateCheckinDialog').open);
byId('stateEnergy').value='75';byId('stateMood').value='70';byId('stateTaqwa').value='65';submit('stateCheckinForm');
check('Check-in speichert Gottesfurcht',evaluate('currentData.stateCheckins[0].taqwa')===65);
query('[data-open-prayer]',e=>e.dataset.openPrayer==='Fajr').click();
query('[data-prayer-option]',e=>e.dataset.prayerOption==='Normal').click();
check('Pflichtgebet wird gespeichert',evaluate('currentData.prayers.Fajr')==='Normal');
check('Pflichtgebet erzeugt keine Tagesrolle',byId('roleHeroName').textContent===''&&byId('rolePickerWrap').hidden);
query('[data-routine-cycle]',e=>e.dataset.routineCycle==='morning').click();
check('Routinekarte wechselt auf erledigt',evaluate('currentData.morningRoutineState')==='done');
query('[data-routine-cycle]',e=>e.dataset.routineCycle==='morning').click();
query('[data-routine-cycle]',e=>e.dataset.routineCycle==='morning').click();
check('Gewissenhafter Status bleibt bedienbar',evaluate('currentData.morningRoutineState')==='responsiblySkipped');
click('addActivity');
byId('templateTitle').value='Lernen';byId('templateRole').value='Absolvent';byId('templatePoints').value='3';click('saveActivityTemplate');
check('Eigene Vorlage erscheint in der Auswahl',byId('activityTemplate').value.startsWith('user_'));
const ownKey=byId('activityTemplate').value;
submit('activityForm');
check('Eigene Aktivität bestimmt Tagesrolle',byId('roleHeroName').textContent==='Absolvent');
check('Rollenfigur und SMART-Text folgen der Rolle',byId('roleMascotImage').src==='mascot-absolvent.jpeg'&&byId('mascotQuote').textContent.includes('Inshallah'));
function addTemplate(key){click('addActivity');byId('activityTemplate').value=key;byId('activityTemplate').dispatch('change');submit('activityForm');}
addTemplate('gym');addTemplate('gym');
check('Punktesummen aktualisieren die Rolle',byId('roleHeroName').textContent==='Vitalist');
query('[data-delete-activity]',e=>e.dataset.deleteActivity==='2').click();
check('Löschen aktualisiert die Rolle',byId('roleHeroName').textContent==='Absolvent');
click('addActivity');byId('templateToEdit').value=ownKey;byId('templateToEdit').dispatch('change');
byId('templateTitle').value='Lernblock';byId('templateRole').value='Wirt';byId('templatePoints').value='8';click('saveActivityTemplate');
check('Vorlagenänderung verändert alte Aktivität nicht',evaluate('currentData.activities[0].role')==='Absolvent'&&evaluate('currentData.activities[0].weight')===3);
submit('activityForm');
check('Neue Aktivität nutzt neue Vorlagenwerte',byId('roleHeroName').textContent==='Wirt');
let files=[];app.downloadTextFile=(name,text)=>files.push({name,text});
app.exportBackup();const backup=JSON.parse(files.at(-1).text);
check('Backup enthält Vorlagen und bisherige Aktivitäten',backup.activityTemplates.length===1&&backup.reviews.some(item=>item.date===day&&item.data.activities.length===3));
app.importBackup({contents:JSON.stringify(backup)});
check('Backup-Import erhält Vorlagen und historische Punkte',app.activityTemplate(ownKey).weight===8&&evaluate('currentData.activities[0].weight')===3);
click('addActivity');byId('templateToEdit').value=ownKey;byId('templateToEdit').dispatch('change');click('deleteActivityTemplate');
check('Vorlagenlöschung erhält historische Aktivitäten',!app.activityTemplate(ownKey)&&evaluate('currentData.activities[0].weight')===3);
click('cancelActivity');
click('addActivity');byId('activityTemplate').value='gym';click('manageActivityTemplate');
check('Ausgewählte Vorlage lässt sich direkt verwalten',byId('activityTemplateEditor').open&&byId('templateToEdit').value==='gym');
click('deleteActivityTemplate');
check('Vorgegebene Vorlage kann entfernt werden',!app.allActivityTemplates().some(item=>item.key==='gym')&&Boolean(app.activityTemplate('gym')));
app.exportBackup();check('Entfernte Vorlagen werden im Backup gespeichert',JSON.parse(files.at(-1).text).settings.hiddenActivityTemplates.includes('gym'));
click('newActivityTemplate');
check('Neue Vorlage öffnet einen leeren Editor',byId('templateToEdit').value===''&&!byId('templateTitle').disabled);
check('Punkteauswahl enthält halbe Schritte',byId('templatePoints').innerHTML.includes('value="0.5"')&&byId('templatePoints').innerHTML.includes('value="1.5"'));
click('cancelActivity');
const month=app.previousMonth(day.slice(0,7));
for(let i=0;i<12;i++){
 const date=app.addDays(`${month}-01`,i);
 localStorage.setItem(app.storageKey(date),JSON.stringify({activities:[{title:i<6?'Gym':'Familienzeit'}],morningRoutineState:i<6?'done':'missed',prayers:{},stateCheckins:[{slot:'morning',energy:i<6?80:40,mood:i<6?75:35,taqwa:60}]}));
}
evaluate(`analysisMonth=${JSON.stringify(month)};analysisAnchor=${JSON.stringify(month+'-01')};roleSplitRange='month'`);
query('.nav-button',e=>e.dataset.page==='analysis').click();
check('Auswertung öffnet mit Beobachtungen',byId('analysisPage').classes.has('active')&&byId('analysisOverview').innerHTML.includes('Grundlage ansehen'));
check('Zusammenhänge und ihre Grundlagen werden dargestellt',byId('analysisPatterns').innerHTML.includes('Prozentpunkte')&&byId('analysisPatterns').innerHTML.includes('keine Ursache'));
check('Rollenübersicht verwendet denselben Zeitraum',byId('roleSplitDistribution').innerHTML.includes('Vitalist'));
click('exportMonthReport');
check('Rückblickexport enthält Beobachtungen und Routinen',files.at(-1).text.includes('Zusammenhänge')&&files.at(-1).text.includes('Morgenroutine'));
check('Rückblickexport enthält keine Fastenstatistik',!files.at(-1).text.includes('Fastentage:'));
app.exportCsv();const rows=files.at(-1).text.split(/\r?\n/).filter(Boolean);const columns=line=>(line.match(/"(?:""|[^"])*"/g)||[]).length;
check('CSV-Spalten bleiben nach den Entfernungen konsistent',rows.every(row=>columns(row)===columns(rows[0])));
query('.nav-button',e=>e.dataset.page==='streaks').click();click('confirmStreakAccess');
check('Geschützte Streaks bleiben zugänglich',byId('streaksPage').classes.has('active'));
query('.nav-button',e=>e.dataset.page==='review').click();
check('Rückkehr zur Hauptseite funktioniert',byId('reviewPage').classes.has('active')&&!byId('appHeader').hidden);
if (process.argv[2]) {
 localStorage.clear();
 const legacy=JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
 app.importBackup({contents:JSON.stringify(legacy)});
 check('Altes Backup importiert alle Tagesdaten unverändert',legacy.reviews.every(item=>JSON.stringify(JSON.parse(localStorage.getItem(app.storageKey(item.date))))===JSON.stringify(item.data)));
 for(const item of legacy.reviews) app.setDate(item.date);
 check('Alle alten Tage lassen sich mit automatischer Rolle laden',!alerts.some(text=>text.includes('Fehler')));
 app.exportBackup();const migrated=JSON.parse(files.at(-1).text);
 check('Neues Backup trägt Ensembly und erhält alle alten Tage',migrated.app==='Ensembly'&&legacy.reviews.every(item=>migrated.reviews.some(row=>row.date===item.date)));
 check('Streak läuft über acht nicht eingetragene Kalendertage',app.loadReview('2026-10-01').streaks.cannabisFree.days===189);
 check('Am 30. September stehen 188 Cannabistage',app.loadReview('2026-09-30').streaks.cannabisFree.days===188);
 app.setDate('2026-10-01');app.saveReview(true);app.setDate('2026-10-10');
 check('Gespeicherte neue Tage stoppen den Zähler nicht',evaluate('currentData.streaks.cannabisFree.days')===198);
 const interruption={streaks:{cannabisFree:{days:0,broken:true,todayStatus:'lapse',calendarCounter:true}}};
 localStorage.setItem(app.storageKey('2026-10-05'),JSON.stringify(interruption));
 check('Bewusste Unterbrechung setzt den Zähler zurück',app.loadReview('2026-10-05').streaks.cannabisFree.days===0&&app.loadReview('2026-10-10').streaks.cannabisFree.days===5);
 localStorage.setItem(app.storageKey('2026-10-07'),JSON.stringify({streaks:{cannabisFree:{days:20,broken:false,calendarCounter:true,counterEvent:'set'}}}));
 check('Manuelle Korrektur läuft nach Kalendertagen weiter',app.loadReview('2026-10-10').streaks.cannabisFree.days===23);
 app.exportBackup();const correctedBackup=JSON.parse(files.at(-1).text);
 localStorage.clear();app.importBackup({contents:JSON.stringify(correctedBackup)});
 check('Korrigierte Streak bleibt nach Backup-Import erhalten',app.loadReview('2026-10-10').streaks.cannabisFree.days===23);
 check('Keine Importfehler beim alten Backup' ,!alerts.some(text=>text.includes('keine gültigen')));
}
console.log(`\nALLE ${count} UI-FUNKTIONSPRÜFUNGEN BESTANDEN (DOM-Testmodell).`);
