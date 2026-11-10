const get=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(value)):'—';
const day=value=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Europe/Paris'}).format(new Date(value));
const metric=(value,digits=3)=>Number.isFinite(value)?value.toLocaleString('fr-FR',{maximumFractionDigits:digits}):'—';
const pct=value=>Number.isFinite(value)?metric(100*value,1)+' %':'—';
const money=value=>value.toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const names=['1','N','2'];
const marketLabels={home:'Victoire domicile',draw:'Match nul',away:'Victoire extérieur','1X':'Domicile ou nul','X2':'Extérieur ou nul',
  '12':'Pas de nul',over05:'Plus de 0,5 but',over15:'Plus de 1,5 but',over25:'Plus de 2,5 buts',under25:'Moins de 2,5 buts',
  under45:'Moins de 4,5 buts',bttsYes:'Les deux marquent',bttsNo:'Les deux ne marquent pas',homeScore:'Domicile marque',
  awayScore:'Extérieur marque',homeOver25:'Domicile gagne + plus de 2,5 buts',awayOver25:'Extérieur gagne + plus de 2,5 buts',
  homeBtts:'Domicile gagne + les deux marquent',awayBtts:'Extérieur gagne + les deux marquent'};
const missing=(reason='Données indisponibles dans ce lot.')=>`<p class="form-note">${safe(reason)}</p>`;
const params={halfLifeDays:'Demi-vie de la forme (jours)',priorMatches:'Poids a priori',eloK:'Facteur Elo',eloHomeAdvantage:'Avantage domicile Elo',
  eloGoalInfluence:'Influence Elo',rho:'Correction Dixon-Coles',maxGoals:'Buts maximum',minHistory:'Historique minimum'};
let current=null,busy=false,activeDay='';
const emptyLeg=()=>({match:'',market:'',odds:''});
let legs=[emptyLeg(),emptyLeg()];

function matchCard(match,ref){
  const p=match.forecast;
  const label=match.createdAt?`Prévision figée le ${stamp(match.createdAt)}`:'Estimation du lot, non archivée';
  const form=match.form?.map((row,i)=>`<p><b>${safe([match.home,match.away,match.home+' à domicile',match.away+' à l’extérieur'][i])}</b> · ${safe(row.series||'Forme indisponible')}${row.series?` · ${metric(row.scored)} pour, ${metric(row.conceded)} contre`:''}</p>`).join('')||'';
  return `<details class="match"${Number.isInteger(ref)?` id="match-${ref}"`:''}><summary>${safe(match.home)} – ${safe(match.away)} · ${stamp(match.at)}</summary>`+
    (match.score?`<p><b>Résultat officiel ${match.score.map(n=>metric(n)).join('–')}</b></p>`:'')+
    (p?`<p class="muted">${label} · modèle ${safe(match.model)} (heure de Paris)</p>
      <div class="forecast">${p.prob.map((v,i)=>`<span${v===Math.max(...p.prob)?' class="best"':''}>${names[i]}<strong>${pct(v)}</strong></span>`).join('')}</div>
      <p>Scores probables · ${p.scores.slice(0,4).map(s=>`${metric(s.h)}–${metric(s.a)} (${pct(s.p)})`).join(' · ')||'—'}</p>
      <p>Plus / moins de 2,5 buts · ${pct(p.markets?.over25)} / ${pct(p.markets?.under25)}. Les deux marquent · ${pct(p.markets?.bttsYes)}.</p>
      <p class="muted">Buts attendus · ${metric(p.lambdaH,2)} / ${metric(p.lambdaA,2)}. Elo · ${metric(p.eloHome,0)} / ${metric(p.eloAway,0)}.
      Historique par équipe · ${metric(p.homeMatches)} / ${metric(p.awayMatches)} matchs. Repos · ${metric(p.homeRestDays)} / ${metric(p.awayRestDays)} jours. Incertitude · ${safe(p.uncertainty||'—')}.</p>`:
      '<p>Prévision indisponible dans ce lot.</p>')+form+'</details>';
}

function settings(values){
  if(!values)return '—';
  return `<details><summary>Paramètres figés</summary><ul>${Object.entries(params).filter(([k])=>Number.isFinite(values[k]))
    .map(([k,label])=>`<li>${label} · ${metric(values[k])}</li>`).join('')}</ul></details>`;
}

function learning(item){
  if(!item)return '<p>Le suivi n’est pas publié.</p>';
  const c=item.comparison, gain=c.championLogloss-c.challengerLogloss;
  const labels={pass:'Validé',fail:'Bloquant',pending:'En attente'};
  return `<p><strong>${safe(item.phase.label)}</strong> · ${safe(item.phase.reason)}</p>
    <p>${metric(c.n)} rencontres comparées · ${metric(item.remaining)} avant le seuil · début ${stamp(item.startedAt)}.</p>
    <p>Historique disponible · ${metric(item.historicalCount)} / ${metric(item.historicalMin)} pour le diagnostic.</p>
    <div class="table"><table><thead><tr><th>Modèle</th><th>Log loss</th><th>Brier</th></tr></thead><tbody>
      <tr><th>Champion · ${safe(item.champion)} ${settings(item.championSettings)}</th><td>${metric(c.championLogloss,4)}</td><td>${metric(c.championBrier,4)}</td></tr>
      <tr><th>Challenger · ${safe(item.challenger||'en attente')} ${settings(item.challengerSettings)}</th><td>${metric(c.challengerLogloss,4)}</td><td>${metric(c.challengerBrier,4)}</td></tr>
    </tbody></table></div>
    <details open><summary>Critères de promotion</summary><ul>${item.criteria.map(row=>`<li>${safe(labels[row.state])} · ${safe(row.label)}</li>`).join('')}</ul></details>
    <details><summary>Évolution du gain · ${metric(gain,4)}</summary><ul>${(c.progression||[]).map(row=>`<li>${safe(row.date)} · ${metric(row.n)} matchs · ${metric(row.gain,4)}</li>`).join('')||'<li>Premiers résultats en attente.</li>'}</ul></details>
    <details><summary>Historique des promotions</summary><ul>${item.promotions.slice().reverse().map(row=>`<li>${stamp(row.at)} · ${safe(row.from)} → ${safe(row.to)}. ${safe(row.reason)}</li>`).join('')||'<li>Aucune promotion enregistrée.</li>'}</ul></details>`;
}

const markets=forecast=>Object.entries(forecast?.markets||{}).filter(([key,p])=>Object.hasOwn(marketLabels,key)&&Number.isFinite(p)&&p>0&&p<=1);
const matchKey=m=>JSON.stringify([m.at,m.home,m.away]);
const future=m=>Date.parse(m?.at)>Date.now();
const matchOptions=value=>'<option value="">Choisir une rencontre</option>'+value.upcoming.filter(m=>future(m)&&markets(m.forecast).length)
  .map(m=>`<option value="${safe(matchKey(m))}">${safe(m.home)} – ${safe(m.away)} · ${stamp(m.at)}</option>`).join('');
const marketOptions=match=>markets(match?.forecast).map(([key])=>`<option value="${safe(key)}">${marketLabels[key]}</option>`).join('');
const findMatch=(value,key)=>value?.upcoming.find(m=>matchKey(m)===key&&future(m));

function renderCalendar(value){
  const weekend=value.dashboard?.weekend;
  const dates=weekend?Array.from({length:4},(_,i)=>new Date(Date.parse(weekend.start+'T12:00:00Z')+i*86400000).toISOString().slice(0,10)):[];
  const rows=value.upcoming.map((match,ref)=>({match,ref})).filter(({match})=>future(match));
  if(activeDay!=='all'&&!dates.includes(activeDay))activeDay=dates.find(date=>rows.some(({match})=>match.date===date))||dates[0]||'all';
  const rangeDate=date=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'}).format(new Date(date+'T12:00:00Z'));
  get('weekend-range').textContent=weekend?`Du ${rangeDate(weekend.start)} au ${rangeDate(weekend.end)}`:'Week-end';
  get('calendar-days').innerHTML=[...dates,'all'].map(date=>`<button type="button" data-day="${safe(date)}" aria-pressed="${activeDay===date}">${date==='all'?'Tous les matchs':
    safe(new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Paris'}).format(new Date(date+'T12:00:00Z')))}</button>`).join('');
  const shown=activeDay==='all'?rows:rows.filter(({match})=>match.date===activeDay);
  const groups=new Map();
  for(const row of shown){
    const date=day(row.match.at);
    groups.set(date,[...(groups.get(date)||[]),row]);
  }
  get('calendar').innerHTML=[...groups].map(([date,group])=>`<h3>${safe(date)}</h3>${group.map(({match,ref})=>matchCard(match,ref)).join('')}`).join('')||
    missing(value.official?'Aucune rencontre à venir pour cette période.':undefined);
}

function renderSelections(value){
  const dashboard=value.dashboard;
  const valid=pick=>pick&&future(value.upcoming[pick.ref])&&Object.hasOwn(marketLabels,pick.market)&&Number.isFinite(pick.p);
  const pickCard=(pick,label,extra='')=>{
    if(!valid(pick))return `<article class="pick"><b>${safe(label)}</b>${missing(value.official?'Aucune sélection admissible.':undefined)}</article>`;
    const m=value.upcoming[pick.ref];
    return `<article class="pick"><small>${safe(label)} · ${stamp(m.at)}</small><h3>${safe(m.home)} – ${safe(m.away)}</h3>
      <p>${safe(marketLabels[pick.market])} · <strong>${pct(pick.p)}</strong></p>
      <span class="badge">Cote équitable ${metric(1/pick.p,2)}</span>${extra}
      <button class="secondary" type="button" data-match-ref="${pick.ref}">Voir la fiche</button></article>`;
  };
  const top=(dashboard?.top||[]).filter(valid);
  get('top-picks').innerHTML=top.map((pick,i)=>pickCard(pick,`Sélection ${i+1}`,
    ` <button class="secondary" type="button" data-compare-ref="${pick.ref}" data-market="${safe(pick.market)}">Simuler cette sélection</button>`)).join('')||
    missing(dashboard?'Aucune sélection du week-end n’atteint les critères.':undefined);
  const combos=[['double','Double'],['triple','Triple'],['alternative','Double alternatif']].flatMap(([key,label])=>{
    const combo=dashboard?.combos?.[key];
    if(!combo||!combo.legs.every(valid))return [];
    return [`<details class="pick combo-card"><summary>${label} · ${pct(combo.p)} · cote équitable ${metric(1/combo.p,2)}</summary>
      <ul>${combo.legs.map(p=>`<li>${safe(value.upcoming[p.ref].home)} – ${safe(value.upcoming[p.ref].away)} · ${safe(marketLabels[p.market])}</li>`).join('')}</ul>
      <button class="secondary" type="button" data-combo="${key}">Personnaliser ce combiné</button></details>`];
  });
  get('auto-combos').innerHTML=combos.join('')||missing(dashboard?'Aucun combiné ne respecte les critères de probabilité et d’équipes distinctes.':undefined);
  get('profiles').innerHTML=[['prudent','Prudent'],['equilibre','Équilibré'],['audacieux','Audacieux']]
    .map(([key,label])=>pickCard(dashboard?.profiles?.[key],label)).join('');
}

function renderAnalysis(value){
  const diagnostic=value.dashboard?.diagnostic;
  get('historical').innerHTML=diagnostic?.ready?`<p><b>Test indépendant · ${metric(diagnostic.n)} matchs.</b> Du ${safe(diagnostic.holdoutStart)} au ${safe(diagnostic.holdoutEnd)} · ${metric(diagnostic.trainingCount)} matchs d’ajustement.</p>
    <div class="table"><table><thead><tr><th>Indicateur</th><th>Brut</th><th>Ajustement candidat</th></tr></thead><tbody><tr><th>Log loss</th><td>${metric(diagnostic.rawLogloss,4)}</td><td>${metric(diagnostic.adjustedLogloss,4)}</td></tr>
    <tr><th>Brier</th><td>${metric(diagnostic.rawBrier,4)}</td><td>${metric(diagnostic.adjustedBrier,4)}</td></tr></tbody></table></div>
    <p>Référence naïve · log loss ${metric(diagnostic.baseline,4)}. Gain du diagnostic ${pct(diagnostic.improvement)}. ${diagnostic.validated?'Ajustement candidat favorable sur ce test.':'Ajustement candidat non validé.'}</p>`:
    missing(diagnostic?`Données insuffisantes pour le diagnostic chronologique · ${metric(diagnostic.n)} prévisions reconstituables sur 200 requises.`:undefined);
  const teams=value.dashboard?.teams||[];
  const cells=row=>row?.n?`${safe(row.series)} · ${metric(row.attack,2)} pour / ${metric(row.defence,2)} contre`:'—';
  get('team-stats').innerHTML=teams.some(t=>t.overall?.n)?`<div class="table"><table><caption>Forme et buts par match</caption><thead><tr><th>Équipe</th><th>Tous terrains</th><th>Domicile</th><th>Extérieur</th></tr></thead>
    <tbody>${teams.map(t=>`<tr><th>${safe(t.name)}</th><td>${cells(t.overall)}</td><td>${cells(t.home)}</td><td>${cells(t.away)}</td></tr>`).join('')}</tbody></table></div>`:missing();
}

function readLegs(){
  return [...get('legs').querySelectorAll('fieldset')].map(field=>({
    match:field.querySelector('[data-leg-match]').value,market:field.querySelector('[data-leg-market]').value,
    odds:field.querySelector('[data-leg-odds]').value}));
}
function renderTicket(value){
  const options=matchOptions(value);
  get('legs').innerHTML=legs.map((leg,i)=>`<fieldset class="leg"><legend>Sélection ${i+1}</legend>
    <label>Match<select data-leg-match>${options}</select></label>
    <label>Marché<select data-leg-market>${marketOptions(findMatch(value,leg.match))}</select></label>
    <label>Cote décimale<input data-leg-odds type="number" inputmode="decimal" min="1.01" max="1000" step="0.01" value="${safe(leg.odds)}"></label>
    ${legs.length>2?`<button type="button" class="secondary" data-remove-leg="${i}">Retirer</button>`:''}</fieldset>`).join('');
  [...get('legs').querySelectorAll('fieldset')].forEach((field,i)=>{
    const match=field.querySelector('[data-leg-match]'),market=field.querySelector('[data-leg-market]');
    match.value=findMatch(value,legs[i].match)?legs[i].match:'';
    if([...market.options].some(o=>o.value===legs[i].market))market.value=legs[i].market;
  });
  get('add-leg').disabled=legs.length>=5;
}

function render(value){
  renderCalendar(value);
  renderSelections(value);
  renderAnalysis(value);
  get('learning').innerHTML=learning(value.learning);
  const perf=value.performance;
  get('performance').innerHTML=perf?`<p>${metric(perf.n)} matchs évalués · ${metric(perf.pending)} en attente · 1/N/2 corrects ${pct(perf.accuracy)} · Brier ${metric(perf.brier,4)} · log loss ${metric(perf.logloss,4)}.</p>
    <details><summary>Calibration</summary><ul>${perf.calibration.map(row=>`<li>${safe(row.range)} · ${metric(row.n)} matchs · attendu ${pct(row.predicted)} · observé ${pct(row.observed)}</li>`).join('')||'<li>Résultats appariés en attente.</li>'}</ul></details>`:'<p>Bilan indisponible.</p>';
  get('recent').innerHTML=value.recent.map(match=>matchCard(match)).join('');
  if(get('legs').children.length)legs=readLegs();
  renderTicket(value);
  const quote=get('quote-form').elements,previous=quote.match.value,market=quote.market.value;
  quote.match.innerHTML=matchOptions(value);
  if(findMatch(value,previous))quote.match.value=previous;
  quote.market.innerHTML=marketOptions(findMatch(value,quote.match.value));
  if([...quote.market.options].some(o=>o.value===market))quote.market.value=market;
}
function updateStatus(message){
  const stale=current?.official&&Date.now()-Date.parse(current.asOf)>48*3600000;
  get('status').textContent=message||(stale?'Lot périmé · dernières prévisions consultables à titre d’archive.':
    current?.official?'Dernier lot autorisé disponible.':'Publication des données non activée.');
  get('milestones').textContent=current?.official?`Collecte ${stamp(current.asOf)} · Dernier résultat ${current.latest||'—'} · Prochain match ${stamp(current.next)} · ${current.period}`:'';
}
async function refresh(){
  if(busy)return;
  busy=true;get('refresh').disabled=true;
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    let response;
    try{response=await fetch('./data/release.json',{cache:'no-store',signal:controller.signal})}
    finally{clearTimeout(timeout)}
    if(!response.ok)throw Error();
    const value=await response.json();
    if(value.schema!==1||!Array.isArray(value.upcoming)||!Array.isArray(value.recent)||
      (value.official&&!Number.isFinite(Date.parse(value.asOf))))throw Error();
    if(!current||current.asOf!==value.asOf){
      if(current?.asOf&&value.asOf&&Date.parse(current.asOf)>Date.parse(value.asOf))throw Error();
      render(value);current=value;get('simulation-result').textContent='';
    }
    updateStatus();
  }catch{
    if(!current)render({upcoming:[],recent:[],learning:null,performance:null});
    updateStatus(current?'Actualisation indisponible · dernier lot chargé conservé.':'Données indisponibles · reconnecte-toi pour charger le dernier lot.');
  }finally{busy=false;get('refresh').disabled=false}
}
get('ticket').addEventListener('submit',event=>{
  event.preventDefault();
  legs=readLegs();
  const output=get('simulation-result'),stake=Number(event.currentTarget.elements.stake.value);
  const choices=legs.filter(leg=>leg.match).map(leg=>({...leg,p:findMatch(current,leg.match)?.forecast?.markets?.[leg.market]}));
  if(choices.length<2||choices.length>5||new Set(choices.map(c=>c.match)).size!==choices.length||
    choices.some(c=>!Number.isFinite(c.p)||c.p<=0||c.p>1||
      (c.odds!==''&&(!Number.isFinite(Number(c.odds))||Number(c.odds)<=1||Number(c.odds)>1000)))||
    !Number.isFinite(stake)||stake<=0||stake>100000){
    output.textContent='Choisis deux à cinq matchs futurs distincts. Une cote saisie doit être supérieure à 1.';return;
  }
  const p=choices.reduce((a,b)=>a*b.p,1),allQuoted=choices.every(c=>c.odds!=='');
  const odds=allQuoted?choices.reduce((a,b)=>a*Number(b.odds),1):null;
  output.textContent=`${choices.length} matchs · Probabilité ${pct(p)} · Cote équitable ${metric(1/p,2)}.`+
    (allQuoted?` Retour brut possible ${money(stake*odds)} · Espérance ${money(stake*(p*odds-1))}.`:
      ' Renseigne toutes les cotes pour calculer le retour et l’espérance.');
});
get('legs').addEventListener('change',event=>{
  if(!event.target.matches('[data-leg-match]'))return;
  const field=event.target.closest('fieldset');
  field.querySelector('[data-leg-market]').innerHTML=marketOptions(findMatch(current,event.target.value));
});
get('legs').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-leg]');
  if(!button||legs.length<=2||!current)return;
  legs=readLegs();legs.splice(Number(button.dataset.removeLeg),1);renderTicket(current);
});
get('add-leg').addEventListener('click',()=>{
  if(legs.length>=5||!current)return;
  legs=[...readLegs(),emptyLeg()];renderTicket(current);
});
get('quote-form').elements.match.addEventListener('change',event=>{
  get('quote-form').elements.market.innerHTML=marketOptions(findMatch(current,event.target.value));
});
get('quote-form').addEventListener('submit',event=>{
  event.preventDefault();
  const {match,market,odds}=event.currentTarget.elements;
  const p=findMatch(current,match.value)?.forecast?.markets?.[market.value],price=Number(odds.value),output=get('quote-result');
  if(!Number.isFinite(p)||p<=0||p>1||!Number.isFinite(price)||price<=1||price>1000){
    output.textContent='Choisis une rencontre, un marché et une cote supérieure à 1.';return;
  }
  output.textContent=`Modèle ${pct(p)} · Probabilité implicite ${pct(1/price)} · Cote équitable ${metric(1/p,2)} · Espérance par euro ${money(p*price-1)}.`;
});
get('calendar-days').addEventListener('click',event=>{
  const button=event.target.closest('[data-day]');
  if(!button||!current)return;
  activeDay=button.dataset.day;renderCalendar(current);
  [...get('calendar-days').querySelectorAll('button')].find(item=>item.dataset.day===activeDay)?.focus();
});
document.addEventListener('click',event=>{
  if(!current)return;
  const button=event.target.closest('[data-match-ref],[data-compare-ref],[data-combo]');
  if(!button)return;
  if(button.dataset.combo){
    const combo=current.dashboard?.combos?.[button.dataset.combo];
    if(!combo?.legs.every(leg=>future(current.upcoming[leg.ref])))return;
    legs=combo.legs.map(leg=>({match:matchKey(current.upcoming[leg.ref]),market:leg.market,odds:''}));
    renderTicket(current);get('simulation').scrollIntoView();return;
  }
  const match=current.upcoming[Number(button.dataset.matchRef??button.dataset.compareRef)];
  if(!future(match))return;
  if(button.dataset.compareRef!==undefined){
    const form=get('quote-form').elements;
    form.match.value=matchKey(match);form.market.innerHTML=marketOptions(match);form.market.value=button.dataset.market;
    get('cotes').scrollIntoView();form.odds.focus();return;
  }
  activeDay=match.date||'all';renderCalendar(current);
  let card=get('match-'+button.dataset.matchRef);
  if(!card){activeDay='all';renderCalendar(current);card=get('match-'+button.dataset.matchRef);}
  if(card){card.open=true;card.scrollIntoView();}
});
get('refresh').addEventListener('click',refresh);
window.addEventListener('online',refresh);
window.addEventListener('pageshow',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden)refresh()},180000);
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js').catch(()=>{});
refresh();
