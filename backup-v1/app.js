(() => {
  'use strict';
  const {Simulation,TYPES,GOODS,ROADX,ROADY,clamp}=Danzig;
  const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SAVE='danzig-city-v1';let sim,loadError=false;
  try{const saved=localStorage.getItem(SAVE);sim=saved?Simulation.fromJSON(JSON.parse(saved)):new Simulation();}catch{sim=new Simulation();loadError=true;}
  let paused=false,speed=1,tab='people',personId=sim.mayorId||1,buildingId='bakery',search='',showLabels=true,lastUI=0,toastTimer;
  let zoom=1,panX=0,panY=0,fit=1,cw=0,ch=0,hover=null,drag=null,lastDraw=0;
  const positions=new Map();
  const canvas=$('map'),ctx=canvas.getContext('2d');
  const portrait=p=>{const adult=p.age>=16,gray=p.age>60,skin=['#d6b98b','#cba57f','#dfc599'][p.id%3],cloth=['#71876a','#95774e','#718b88','#7c7291','#9d795c'][p.id%5],hair=gray?'#b1b09d':['#635c45','#7e643e','#4c4f3c'][p.id%3];return `<span class="avatar"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#dee3cf"/><path d="M6 64Q8 43 25 43L39 43Q56 44 59 64" fill="${cloth}"/><path d="M26 40L38 40L39 50L32 55L25 49Z" fill="${skin}"/><ellipse cx="32" cy="29" rx="${adult?13:11}" ry="17" fill="${skin}"/><path d="M18 28Q14 10 31 9Q49 9 46 28L41 20L25 20Z" fill="${hair}"/>${p.sex==='f'?`<path d="M18 23L13 43L23 46L24 25M44 23L50 44L41 47L40 24" fill="${hair}"/>`:''}<path d="M25 29h3M36 29h3" stroke="#5e5f49" stroke-width="1.7"/><path d="M29 37Q32 39 35 37" fill="none" stroke="#ad8061" stroke-width="1.3"/>${p.id===sim.mayorId?'<path d="M16 20L21 9L43 9L49 20Z" fill="#455b43"/><path d="M16 20H49" stroke="#b4a471" stroke-width="3"/>':''}</svg></span>`;};
  const toast=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);};
  const money=n=>Math.floor(n).toLocaleString('ru-RU');
  const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  const need=(label,v)=>`<div class="need"><span>${label}</span><div class="bar"><i class="${v<30?'low':''}" style="width:${clamp(v)}%"></i></div><span>${Math.round(v)}%</span></div>`;
  const personButton=(p,compact=false)=>`<button class="person-row ${p.id===personId?'selected':''}" data-person="${p.id}">${portrait(p)}<span><strong>${esc(p.name)}</strong><small>${esc(p.role)}${p.sick?' · болеет':''}</small></span><span class="row-age">${p.age} л.</span></button>`;
  function selectPerson(id){const p=sim.person(id);if(!p)return;personId=p.id;tab='people';updateUI(true);}
  function selectBuilding(id){buildingId=id;tab='buildings';updateUI(true);}
  function renderPeople(){
    const p=sim.person(personId)||sim.alive[0];if(!p)return '<h2 class="city-title">Город опустел</h2><p class="muted">Начните новую историю, чтобы снова заселить улицы.</p>';
    const home=sim.building(p.homeId),job=sim.building(p.jobId),spouse=sim.person(p.spouseId),friend=sim.person(p.friendId),family=sim.alive.filter(q=>q.parents.includes(p.id));
    const state=p.alive?(p.path.length?'В пути':p.action):'В памяти города';
    return `<div class="panel-eyebrow"><span>ГОРОЖАНИН № ${String(p.id).padStart(3,'0')}</span><span class="status-tag">${esc(state)}</span></div>
      <div class="person-heading">${portrait(p)}<div><h2>${esc(p.name)}</h2><p>${p.age} лет · ${esc(p.role)}<br>${p.id===sim.mayorId?'Избранный глава города':p.age<16?'Юный житель Данцига':'Горожанин Данцига'}</p></div></div>
      <div class="traits">${p.traits.map(t=>`<span class="trait">${esc(t)}</span>`).join('')}</div>
      <blockquote class="quote">«${esc(p.reason)}»</blockquote>
      <div class="section-label">САМОЧУВСТВИЕ <span>${p.sick?'БОЛЕЕТ':p.health<40?'ТРЕВОЖНО':'В НОРМЕ'}</span></div>
      ${need('Сытость',p.hunger)}${need('Энергия',p.energy)}${need('Общение',p.social)}${need('Настроение',p.mood)}
      <div class="detail-rows"><div class="detail-row"><span>Дом</span><b><button class="inline-link" data-building="${home.id}">${esc(home.name)}</button></b></div>
      <div class="detail-row"><span>Ремесло</span><b>${job?`<button class="inline-link" data-building="${job.id}">${esc(job.name)}</button>`:p.age<16?'Ещё растёт':'Свободный горожанин'}</b></div>
      <div class="detail-row"><span>Сбережения</span><b>${money(p.coins)} тал. <span class="muted"> / +${p.earned.toFixed(1)} за день</span></b></div>
      <div class="detail-row"><span>Репутация</span><b>${Math.round(p.reputation)} / 100</b></div>
      <div class="detail-row"><span>Семья</span><b>${spouse?.alive?`<button class="inline-link" data-person="${spouse.id}">${esc(spouse.name)}</button>`:p.age<16?'Живёт с родителями':'Не в браке'}${family.length?' · детей: '+family.length:''}</b></div>
      ${friend?.alive?`<div class="detail-row"><span>Близкий друг</span><b><button class="inline-link" data-person="${friend.id}">${esc(friend.name)}</button></b></div>`:''}</div>
      <div class="activity"><span class="activity-icon">${p.path.length?'↗':'◷'}</span><div>${p.path.length?'Идёт: ':''}${esc(p.path.length?sim.building(p.goal).name:p.action)}<small>${p.alive?'Сейчас · '+clock(sim.minute):'История этого жителя завершена'}</small></div></div>
      <div class="population-head"><div class="section-label">ЖИТЕЛИ ГОРОДА</div><span class="count-label">${sim.alive.length}</span></div>
      <input id="people-search" class="search" placeholder="Найти имя или ремесло…" aria-label="Найти жителя" value="${esc(search)}"><div class="people-list">${filteredPeople()}</div>`;
  }
  function filteredPeople(){const q=search.toLocaleLowerCase('ru');const people=sim.alive.filter(p=>(p.name+' '+p.role+' '+p.traits.join(' ')).toLocaleLowerCase('ru').includes(q));return people.length?people.map(p=>personButton(p)).join(''):'<div class="empty">Никого не нашлось.</div>';}
  function renderBuildings(){
    const b=sim.building(buildingId),t=TYPES[b.type],workers=sim.workers(b.id),residents=sim.alive.filter(p=>p.homeId===b.id),recipe=t.recipe,inside=sim.occupants(b.id);
    return `<div class="panel-eyebrow"><span>${esc(t.name.toUpperCase())}</span><span class="status-tag">${b.damaged?'ПОСЛЕ ПОЖАРА':inside.length+' ЧЕЛ. ВНУТРИ'}</span></div><div class="building-detail"><h2>${esc(b.name)}</h2><p class="muted">${esc(t.description)}</p></div>
    ${recipe?`<div class="production">${recipe.input?recipe.cost+' '+GOODS[recipe.input].toLowerCase():'Труд мастеров'} <span style="color:#9a9c78"> → </span> ${recipe.amount} ${GOODS[recipe.out].toLowerCase()}<small>${b.damaged?'Работа остановлена':recipe.input&&sim.goods[recipe.input]<recipe.cost?'Не хватает сырья':'Произведено сегодня: '+b.today+' · за всё время: '+b.output}</small></div>`:''}
    ${b.damaged?`<button class="minor-button" data-action="repair" data-target-building="${b.id}">Восстановить это здание · 35 тал.</button>`:''}
    <div class="section-label">${b.type==='home'?'ЖИЛЬЦЫ':'РАБОТНИКИ'}<span>${b.type==='home'?residents.length:workers.length+' / '+t.slots}</span></div>
    ${(b.type==='home'?residents:workers).map(p=>personButton(p,true)).join('')||'<p class="empty">Работников пока нет.</p>'}
    <div class="section-label">ЗДАНИЯ ГОРОДА<span>${sim.buildings.length}</span></div><div class="build-list">${sim.buildings.map(q=>`<button class="building-row ${q.id===b.id?'selected':''}" data-building="${q.id}"><span class="building-symbol">${TYPES[q.type].symbol}</span><span><strong>${esc(q.name)}</strong><small>${q.damaged?'Повреждено пожаром':q.type==='home'?sim.alive.filter(p=>p.homeId===q.id).length+' жильцов':TYPES[q.type].name}</small></span></button>`).join('')}</div>`;
  }
  function renderCity(){const mayor=sim.person(sim.mayorId),damaged=sim.buildings.filter(b=>b.damaged).length;return `<div class="panel-eyebrow"><span>ГОРОДСКОЙ СОВЕТ</span><span class="status-tag">${sim.season.toUpperCase()}</span></div><h2 class="city-title">Дела вольного города</h2><p class="muted">Маленькие решения меняют повседневную жизнь. Наблюдайте за последствиями.</p>
    <div class="detail-rows"><div class="detail-row"><span>Бургомистр</span><b>${mayor?`<button class="inline-link" data-person="${mayor.id}">${esc(mayor.name)}</button>`:'Вакантно'}</b></div><div class="detail-row"><span>Следующие выборы</span><b>Через ${12-sim.day%12} дн.</b></div><div class="detail-row"><span>Родилось / умерло</span><b>${sim.births} / ${sim.deaths}</b></div></div>
    <label class="tax-label" for="tax"><span>Налог на заработок</span><b id="tax-value">${sim.tax}%</b></label><input id="tax" type="range" min="0" max="30" step="1" value="${sim.tax}" aria-label="Налог на заработок"><div class="muted" style="font-size:9px">Выше налог — больше казна, ниже довольство.</div>
    <div class="section-label">ГОРОДСКИЕ ЗАПАСЫ</div><div class="resource-grid">${Object.entries(GOODS).map(([id,name])=>`<div class="resource-row"><span>${name}</span><b>${money(sim.goods[id])}</b></div>`).join('')}</div>
    <div class="section-label">ВАШЕ ВЛИЯНИЕ</div>
    <button class="city-action" data-action="food" ${sim.treasury<45?'disabled':''}><span><strong>Закупить продовольствие</strong><small>75 порций хлеба из соседнего города</small></span><span>45 тал.</span></button>
    <button class="city-action" data-action="festival" ${sim.treasury<65||sim.festivalDay===sim.day?'disabled':''}><span><strong>${sim.festivalDay===sim.day?'Сегодня — городской праздник':'Устроить городской праздник'}</strong><small>Поднять настроение, собрать жителей на рынке</small></span><span>65 тал.</span></button>
    <button class="city-action" data-action="repair" ${sim.treasury<35||!damaged?'disabled':''}><span><strong>Помочь после пожара</strong><small>${damaged?'Повреждено зданий: '+damaged+'. Ремонт одного.':'Все здания в порядке'}</small></span><span>35 тал.</span></button>
    <p class="muted" style="margin-top:20px;font-size:9px">Время сжато: 24 дня = год. Продукты хранятся на общем рынке. Это наблюдаемая модель города, а не точная реконструкция XV века.</p>`;}
  function renderLog(){return `<div class="panel-eyebrow"><span>ГОРОДСКАЯ ЛЕТОПИСЬ</span><span class="status-tag">ДЕНЬ ${sim.day+1}</span></div><h2 class="city-title">То, что останется</h2><p class="muted">Свадьбы, ремёсла, выборы и мелкие ссоры. История складывается из жизни людей.</p><div class="log-list">${sim.events.map(e=>`<article class="log-item"><small>ДЕНЬ ${e.day+1} · ${clock(e.minute)} · ${{politics:'СОВЕТ',family:'СЕМЬЯ',fire:'ПОЖАР',death:'ПАМЯТЬ',health:'ЗДОРОВЬЕ',economy:'ТОРГОВЛЯ',conflict:'ПРОИСШЕСТВИЕ',food:'ПРОДОВОЛЬСТВИЕ',festival:'ПРАЗДНИК',season:'СЕЗОН'}[e.type]||'ЖИЗНЬ'}</small><p>${e.personId?`<button data-person="${e.personId}">${esc(e.text)}</button>`:esc(e.text)}</p></article>`).join('')}</div>`;}
  function updateUI(force=false){
    $('season').textContent=sim.season.toUpperCase()+' · '+sim.year;
    $('date').textContent=(sim.day%6+1)+' '+['марта','июня','сентября','декабря'][Math.floor(sim.day%24/6)];$('time').textContent=clock(sim.minute);$('weather').textContent=sim.weather;
    $('population').textContent=sim.alive.length;$('treasury').textContent=money(sim.treasury);$('food').textContent=money(sim.food);$('happiness').textContent=sim.happiness+'%';$('day-count').textContent='День '+(sim.day+1);
    $('latest-event').textContent=sim.events[0]?.text||'';$('map-status').textContent=sim.hour<6||sim.hour>=22?'Окна гаснут. Город засыпает':sim.hour<8?'Город просыпается':sim.hour<17?'Стучат молотки, работают печи':'Время вечерних разговоров';
    $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить симуляцию':'Приостановить симуляцию');
    document.querySelector('.live-label').innerHTML=`<i></i> ${paused?'ВРЕМЯ ОСТАНОВЛЕНО':'ГОРОД ЖИВЁТ'}`;
    for(const b of document.querySelectorAll('[data-tab]')){b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));}
    for(const b of document.querySelectorAll('[data-speed]')){b.classList.toggle('active',Number(b.dataset.speed)===speed);b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===speed));}
    if(!force&&['people-search','tax'].includes(document.activeElement?.id))return;
    const scroll={};for(const e of $('panel').querySelectorAll('.people-list,.build-list,.log-list'))scroll[e.className]=e.scrollTop;
    $('panel').innerHTML=tab==='people'?renderPeople():tab==='buildings'?renderBuildings():tab==='city'?renderCity():renderLog();
    for(const e of $('panel').querySelectorAll('.people-list,.build-list,.log-list'))e.scrollTop=scroll[e.className]||0;
  }
  function save(show=false){try{localStorage.setItem(SAVE,JSON.stringify(sim));$('save-status').textContent='Сохранено · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});if(show)toast('История города сохранена в этом браузере');}catch{$('save-status').textContent='Сохранение недоступно';if(show)toast('Браузер не разрешил сохранить город');}}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.person)selectPerson(b.dataset.person);
    if(b.dataset.building)selectBuilding(b.dataset.building);
    if(b.dataset.tab){tab=b.dataset.tab;updateUI(true);}
    if(b.dataset.speed){speed=Number(b.dataset.speed);paused=false;updateUI(true);}
    if(b.dataset.action){toast(sim.act(b.dataset.action,b.dataset.targetBuilding).message);updateUI(true);save();}
    if(b.hasAttribute('data-close'))b.closest('dialog').close();
  });
  $('panel').addEventListener('input',e=>{if(e.target.id==='people-search'){search=e.target.value;$('panel').querySelector('.people-list').innerHTML=filteredPeople();}if(e.target.id==='tax')$('tax-value').textContent=e.target.value+'%';});
  $('panel').addEventListener('change',e=>{if(e.target.id==='tax'){sim.setTax(e.target.value);e.target.blur();updateUI(true);save();}});
  $('pause').onclick=()=>{paused=!paused;updateUI(true);};$('next-day').onclick=()=>{sim.nextMorning();updateUI(true);save();};$('open-log').onclick=()=>{tab='log';updateUI(true);};
  $('save').onclick=()=>save(true);$('help').onclick=()=>$('help-dialog').showModal();$('reset').onclick=()=>$('reset-dialog').showModal();
  $('confirm-reset').onclick=()=>{sim=new Simulation();personId=sim.mayorId;buildingId='bakery';search='';paused=false;speed=1;zoom=1;panX=panY=0;$('reset-dialog').close();updateUI(true);save();toast('У города начинается новая история');};
  $('labels').onclick=()=>{showLabels=!showLabels;$('labels').setAttribute('aria-pressed',String(showLabels));};
  $('zoom-in').onclick=()=>{zoom=Math.min(2.3,zoom+.2);};$('zoom-out').onclick=()=>{zoom=Math.max(.85,zoom-.2);if(zoom<=1)panX=panY=0;};$('center').onclick=()=>{zoom=1;panX=panY=0;};
  document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();paused=!paused;updateUI(true);}if(['1','2','3'].includes(e.key)){speed={1:1,2:3,3:10}[e.key];paused=false;updateUI(true);}});
  window.addEventListener('beforeunload',()=>save());setInterval(()=>save(),30000);
  // The terrain is drawn once. People, smoke, lights, selections and work states stay live.
  const terrain=document.createElement('canvas');terrain.width=2320;terrain.height=1640;const g=terrain.getContext('2d');g.scale(2,2);
  let decorSeed=271;const rnd=()=>{decorSeed=(decorSeed*1664525+1013904223)>>>0;return decorSeed/4294967296;};
  function poly(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
  function tree(c,x,y,s=1){c.fillStyle='#415c3922';c.beginPath();c.ellipse(x+5*s,y+7*s,13*s,6*s,0,0,Math.PI*2);c.fill();c.fillStyle='#837a51';c.fillRect(x-1*s,y,2*s,12*s);for(const [dx,dy,r,color] of [[0,-9,12,'#95a274'],[-6,-7,8,'#87966a'],[5,-14,8,'#a2ad7e']]){c.fillStyle=color;c.beginPath();c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);c.fill();}}
  function terrainDraw(){
    g.fillStyle='#dce0c7';g.fillRect(0,0,1160,820);
    for(let i=0;i<1900;i++){g.fillStyle=rnd()>.4?'#687d3912':'#fffde528';const x=rnd()*1160,y=rnd()*820;g.fillRect(x,y,1+rnd()*3,1+rnd()*2);}
    // Parcels and walled gardens.
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){g.fillStyle=['#d6dbc0','#dde0c5','#d2d9ba'][Math.floor(rnd()*3)];g.fillRect([42,220,425,650][i],[51,217,394,595][j],i===0?110:145,j===0?93:108);}
    // Baltic waterfront.
    g.beginPath();g.moveTo(1010,0);g.bezierCurveTo(966,180,1043,250,983,412);g.bezierCurveTo(947,560,1025,650,979,820);g.lineTo(1160,820);g.lineTo(1160,0);g.closePath();g.fillStyle='#92b5ab';g.fill();g.lineWidth=9;g.strokeStyle='#bbcaad';g.stroke();
    for(let i=0;i<70;i++){const x=1020+rnd()*130,y=rnd()*820;g.strokeStyle='#d3e1c944';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+9,y-3,x+20,y);g.stroke();}
    g.save();g.translate(1088,425);g.rotate(-Math.PI/2);g.font='italic 26px Georgia';g.fillStyle='#527b745e';g.textAlign='center';g.fillText('Мотлава',0,0);g.restore();
    // Street network.
    for(const x of ROADX){g.fillStyle='#c7c9a9';g.fillRect(x-12,42,24,745);g.fillStyle='#e7dfbd';g.fillRect(x-9,42,18,745);}
    for(const y of ROADY){g.fillStyle='#c7c9a9';g.fillRect(33,y-13,943,26);g.fillStyle='#e8e0bf';g.fillRect(33,y-10,943,20);}
    for(let i=0;i<250;i++){const horizontal=rnd()>.5,x=horizontal?40+rnd()*920:ROADX[Math.floor(rnd()*4)]+rnd()*14-7,y=horizontal?ROADY[Math.floor(rnd()*4)]+rnd()*15-7:45+rnd()*730;g.strokeStyle='#a4a28230';g.beginPath();g.moveTo(x,y);g.lineTo(x+3,y+1);g.stroke();}
    // Plaza, herb garden and crop rows.
    g.fillStyle='#d0cbae';g.fillRect(423,394,145,115);g.strokeStyle='#b3b39466';g.lineWidth=.8;for(let x=430;x<563;x+=14){g.beginPath();g.moveTo(x,397);g.lineTo(x,506);g.stroke();}for(let y=402;y<508;y+=13){g.beginPath();g.moveTo(427,y);g.lineTo(563,y);g.stroke();}
    for(let i=0;i<8;i++){g.fillStyle=i%2?'#b1b781':'#c8c68e';g.fillRect(35+i*15,577,10,39);g.fillStyle='#e1d197';for(let y=580;y<611;y+=7)g.fillRect(36+i*15,y,8,2);}
    for(let i=0;i<4;i++){g.fillStyle='#9caa7e';g.fillRect(753,420+i*15,23,10);}
    for(const b of sim.buildings){const e=sim.entrance(b),ry=ROADY.reduce((a,y)=>Math.abs(y-e.y)<Math.abs(a-e.y)?y:a);g.fillStyle='#dfd9b5';g.fillRect(e.x-5,Math.min(e.y,ry),10,Math.abs(e.y-ry));}
    // Quays and sailing craft.
    for(const y of [356,482,650]){g.fillStyle='#b19f76';g.fillRect(953,y,82,19);g.strokeStyle='#806f54';for(let x=958;x<1034;x+=9){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+19);g.stroke();}}
    const boat=(x,y,s)=>{g.save();g.translate(x,y);g.scale(s,s);poly(g,[[-13,-31],[13,-25],[16,22],[0,37],[-16,22]],'#877052','#655e48');g.strokeStyle='#6c6a50';g.lineWidth=2;g.beginPath();g.moveTo(0,-34);g.lineTo(0,26);g.stroke();poly(g,[[1,-25],[31,14],[1,9]],'#eeead3','#d4cfb8');poly(g,[[-3,-19],[-23,10],[-3,6]],'#dadbc3');g.restore();};boat(1045,276,.9);boat(1057,635,.7);
    // A low town wall, gates and shade trees.
    g.strokeStyle='#88967a';g.lineWidth=9;g.beginPath();g.moveTo(26,145);g.lineTo(26,37);g.lineTo(972,37);g.stroke();g.strokeStyle='#b0b89b';g.lineWidth=5;g.stroke();
    for(let x=31;x<970;x+=21){g.fillStyle='#a4af92';g.fillRect(x,30,10,8);g.fillStyle='#7b8b7355';g.fillRect(x+2,39,10,4);}
    for(let i=0;i<135;i++){const x=20+rnd()*948,y=60+rnd()*730;const onRoad=ROADX.some(v=>Math.abs(v-x)<27)||ROADY.some(v=>Math.abs(v-y)<30),onBuilding=sim.buildings.some(b=>Math.abs(b.x-x)<b.w/2+27&&Math.abs(b.y-y)<b.h/2+42);if(!onRoad&&!onBuilding)tree(g,x,y,.55+rnd()*.5);}
    for(let i=0;i<11;i++)tree(g,45+i*20,535+(i%2)*7,.7);
    g.fillStyle='#8d997d';g.font='italic 11px Georgia';g.textAlign='center';g.fillText('Длинная улица',600,349);g.fillText('Улица ремесленников',537,699);
  }
  terrainDraw();
  function buildingDraw(c,b,selected){
    const {x,y,w,h}=b,t=TYPES[b.type],depth=14,roof=h*.53;
    c.fillStyle='#334c3620';c.beginPath();c.ellipse(x+9,y+12,w*.65,h*.6,0,0,Math.PI*2);c.fill();
    if(b.type==='market'){
      for(let i=0;i<4;i++){const bx=x+(i%2?34:-35),by=y+(i>1?23:-24);c.fillStyle='#b0a077';c.fillRect(bx-16,by-4,32,20);c.fillStyle='#6f7256';c.fillRect(bx-15,by+16,2,7);c.fillRect(bx+13,by+16,2,7);for(let j=0;j<4;j++){c.fillStyle=j%2?'#e8dcb6':i%2?'#8b9c79':'#bb8c6a';c.fillRect(bx-18+j*9,by-9,9,17);}poly(c,[[bx-18,by-9],[bx,by-18],[bx+18,by-9]],i%2?'#718963':'#aa765c');}
      c.fillStyle='#9aab90';c.beginPath();c.ellipse(x,y,10,7,0,0,Math.PI*2);c.fill();c.fillStyle='#90b3a0';c.beginPath();c.ellipse(x,y-2,7,4,0,0,Math.PI*2);c.fill();
    }else{
      poly(c,[[x-w/2,y],[x+w/2,y],[x+w/2,y+h/2+depth],[x-w/2,y+h/2+depth]],'#d8c8a3','#9c9b7b');
      poly(c,[[x+w/2,y],[x+w/2+8,y-8],[x+w/2+8,y+h/2+3],[x+w/2,y+h/2+depth]],'#aaab87');
      poly(c,[[x-w/2-5,y+3],[x,y-roof],[x+w/2+5,y+3]],t.color,'#6b725653');
      poly(c,[[x,y-roof],[x+8,y-roof-7],[x+w/2+12,y-5],[x+w/2+5,y+3]],'#726e58');
      c.strokeStyle='#efdfba33';c.lineWidth=1;for(let i=1;i<5;i++){const k=i/5;c.beginPath();c.moveTo(x-w/2*(1-k),y-roof*k);c.lineTo(x+w/2*(1-k),y-roof*k);c.stroke();}
      if(b.type==='home'||b.type==='tavern'||b.type==='bakery'){c.strokeStyle='#776e504d';c.lineWidth=2;c.beginPath();c.moveTo(x-w/2,y+7);c.lineTo(x+w/2,y+7);c.moveTo(x-w*.32,y+2);c.lineTo(x-w*.32,y+h/2+13);c.moveTo(x+w*.32,y+2);c.lineTo(x+w*.32,y+h/2+13);c.stroke();}
      c.fillStyle='#687b65';for(const dx of [-w*.3,w*.3]){c.fillRect(x+dx-3,y+10,6,8);c.fillStyle='#e5d5a6';c.fillRect(x+dx-1,y+11,1,7);c.fillStyle='#687b65';}
      c.fillStyle='#7e7960';c.fillRect(x-5,y+h/2,10,depth);c.fillStyle='#bbb990';c.fillRect(x-7,y+h/2+depth,14,3);
      if(['home','bakery','tavern','smith'].includes(b.type)){c.fillStyle='#a19b7d';c.fillRect(x+w*.22,y-roof-6,7,14);c.fillStyle='#85846a';c.fillRect(x+w*.22-1,y-roof-8,9,3);}
      if(b.type==='church'||b.type==='hall'){
        const tx=x-w*.22,ty=y-roof;c.fillStyle='#c4b99b';c.fillRect(tx-11,ty-23,22,49);poly(c,[[tx-15,ty-23],[tx,ty-51],[tx+15,ty-23]],b.type==='church'?'#778a79':'#956756','#78806a');c.fillStyle='#626f5b';c.fillRect(tx-3,ty-15,6,10);
        if(b.type==='church'){c.strokeStyle='#737a59';c.lineWidth=2;c.beginPath();c.moveTo(tx,ty-64);c.lineTo(tx,ty-49);c.moveTo(tx-5,ty-59);c.lineTo(tx+5,ty-59);c.stroke();}else{c.fillStyle='#e1dabc';c.beginPath();c.arc(tx,ty+4,5,0,Math.PI*2);c.fill();c.strokeStyle='#7e835e';c.beginPath();c.moveTo(tx,ty);c.lineTo(tx,ty+4);c.lineTo(tx+3,ty+6);c.stroke();}
      }
      if(b.type==='mill'){const mx=x,my=y-12;c.strokeStyle='#dfd8ba';c.lineWidth=5;for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;c.beginPath();c.moveTo(mx+Math.cos(a)*5,my+Math.sin(a)*5);c.lineTo(mx+Math.cos(a)*39,my+Math.sin(a)*39);c.stroke();}c.fillStyle='#766f54';c.beginPath();c.arc(mx,my,4,0,Math.PI*2);c.fill();}
      if(b.type==='clinic'){c.fillStyle='#79886a';c.fillRect(x-2,y-17,4,15);c.fillRect(x-7,y-12,14,4);}
      if(b.type==='smith'){c.fillStyle='#676e5a';c.fillRect(x+w/2+7,y+15,18,8);c.fillRect(x+w/2+12,y+22,8,6);}
      if(b.type==='wood'){for(let i=0;i<5;i++){c.fillStyle='#a09368';c.fillRect(x+35,y+i*5-3,27,4);c.fillStyle='#d2bd8f';c.beginPath();c.arc(x+61,y+i*5-1,2,0,Math.PI*2);c.fill();}}
    }
    if(b.damaged){c.fillStyle='#423d333d';c.fillRect(x-w/2,y-h/2,w,h);c.fillStyle='#bd6e42';c.font='bold 23px Georgia';c.textAlign='center';c.fillText('!',x,y-12);}
    if(selected){c.strokeStyle='#bd9250';c.lineWidth=2;c.setLineDash([4,4]);c.strokeRect(x-w/2-10,y-h/2-10,w+20,h+34);c.setLineDash([]);}
  }
  const shortNames={farm:'Поля',mill:'Мельница',bakery:'Пекарня',smith:'Кузница',wood:'Лесной двор',fish:'Рыбаки',tavern:'Три гуся',church:'Св. Мария',hall:'Ратуша',market:'Длинный рынок',clinic:'Лечебница',school:'Школа',dock:'Пристань'};
  function transform(){const s=fit*zoom;return {s,x:(cw-1160*s)/2+panX,y:(ch-820*s)/2+panY};}
  function draw(now){
    const {s,x,y}=transform(),dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#dce0c7';ctx.fillRect(0,0,cw,ch);ctx.translate(x,y);ctx.scale(s,s);ctx.drawImage(terrain,0,0,1160,820);
    // Selected resident's remaining route.
    const selected=tab==='people'?sim.person(personId):null;
    if(selected?.alive && selected.path.length){ctx.strokeStyle='#b58c5266';ctx.lineWidth=3;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(selected.x,selected.y);for(const node of selected.path)ctx.lineTo(node.x,node.y);ctx.stroke();ctx.setLineDash([]);}
    for(const b of sim.buildings.slice().sort((a,b)=>a.y-b.y))buildingDraw(ctx,b,tab==='buildings'&&b.id===buildingId);
    if(showLabels)for(const b of sim.buildings){if(b.type==='home')continue;const compact=cw<600&&zoom<1.6;if(compact&&!['church','hall','market'].includes(b.type))continue;const label=compact?{church:'Церковь',hall:'Ратуша',market:'Рынок'}[b.type]:shortNames[b.type],ly=b.y+b.h/2+37,fontSize=compact?10/s:Math.max(12,9/s);ctx.font=fontSize+'px "Segoe UI",sans-serif';ctx.textAlign='center';const w=ctx.measureText(label).width+12;ctx.fillStyle='#f0eed9cf';ctx.fillRect(b.x-w/2,ly-fontSize,w,fontSize+5);ctx.fillStyle='#5d7056';ctx.fillText(label,b.x,ly+1);}
    const blend=Math.min(1,(now-lastDraw)/90);lastDraw=now;
    for(const p of sim.alive){
      const visible=p.path.length||['На рынке','Гуляет','На празднике','Работает','Учится','На службе','В трактире'].includes(p.action);
      const angle=(p.id*2.39996),offset=p.path.length?{x:0,y:0}:{x:Math.cos(angle)*(8+p.id%5*3),y:Math.sin(angle)*(5+p.id%4*2)};
      const previous=positions.get(p.id)||{x:p.x,y:p.y};previous.x+=(p.x-previous.x)*blend;previous.y+=(p.y-previous.y)*blend;positions.set(p.id,previous);
      const px=previous.x+offset.x,py=previous.y+offset.y;
      if(!visible&&p.id!==personId)continue;
      if(p.id===personId&&tab==='people'){ctx.strokeStyle='#c19957';ctx.lineWidth=2/s;ctx.beginPath();ctx.arc(px,py-2,10+Math.sin(now*.003),0,Math.PI*2);ctx.stroke();ctx.fillStyle='#bf97522a';ctx.fill();}
      ctx.fillStyle='#42523930';ctx.beginPath();ctx.ellipse(px+1,py+4,5,2,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=p.role==='Священнослужитель'||p.role==='Бургомистр'?'#857296':p.age<16||!p.jobId?'#577c54':'#b57d42';
      ctx.fillRect(px-2.5,py-2,5,p.age<16?4:6);ctx.fillStyle='#e0c497';ctx.beginPath();ctx.arc(px,py-4,p.age<16?2.1:2.6,0,Math.PI*2);ctx.fill();
      if(p.path.length){ctx.strokeStyle='#526744';ctx.lineWidth=1.3;const step=Math.sin(now*.012+p.id)*2;ctx.beginPath();ctx.moveTo(px-1.5,py+3);ctx.lineTo(px-1.5+step,py+6);ctx.moveTo(px+1.5,py+3);ctx.lineTo(px+1.5-step,py+6);ctx.stroke();}
    }
    if(sim.hour>=8&&sim.hour<17)for(const id of ['bakery','smith']){const b=sim.building(id);if(b.damaged||!sim.occupants(id).length)continue;for(let j=0;j<3;j++){const phase=(now*.0003+j*.3)%1;ctx.fillStyle=`rgba(110,119,103,${.25*(1-phase)})`;ctx.beginPath();ctx.arc(b.x+b.w*.22+Math.sin(phase*4)*5,b.y-b.h*.53-12-phase*30,4+phase*5,0,Math.PI*2);ctx.fill();}}
    const night=sim.hour<5||sim.hour>=22?.3:sim.hour<7||sim.hour>=20?.13:0;
    if(night){ctx.fillStyle=`rgba(30,51,70,${night})`;ctx.fillRect(0,0,1160,820);for(const b of sim.buildings){if(b.type==='home'||b.type==='tavern'){ctx.fillStyle='#f3d188bb';ctx.fillRect(b.x-b.w*.3-2,b.y+11,4,5);}}}
    if(hover){const p=hover.kind==='person'?sim.person(hover.id):null,b=hover.kind==='building'?sim.building(hover.id):null;ctx.strokeStyle='#f7f2d8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p?p.x:b.x,p?p.y:b.y,p?9:Math.max(b.w,b.h)*.6,0,Math.PI*2);ctx.stroke();}
  }
  function resize(){const r=canvas.getBoundingClientRect();cw=r.width;ch=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);fit=Math.min(cw/1160,ch/820);}
  new ResizeObserver(resize).observe(canvas);resize();
  const worldAt=e=>{const r=canvas.getBoundingClientRect(),t=transform();return{x:(e.clientX-r.left-t.x)/t.s,y:(e.clientY-r.top-t.y)/t.s,sx:e.clientX-r.left,sy:e.clientY-r.top};};
  function hit(point){
    const radius=Math.max(9,6/(fit*zoom));
    const distance=p=>{const at=positions.get(p.id)||p,angle=p.id*2.39996,dx=p.path.length?0:Math.cos(angle)*(8+p.id%5*3),dy=p.path.length?0:Math.sin(angle)*(5+p.id%4*2);return Math.hypot(at.x+dx-point.x,at.y+dy-point.y);};
    const p=sim.alive.filter(p=>p.path.length||p.id===personId||['На рынке','Гуляет','На празднике','Работает','Учится','На службе','В трактире'].includes(p.action)).sort((a,b)=>distance(a)-distance(b))[0];
    if(p&&distance(p)<radius)return {kind:'person',id:p.id};
    const b=sim.buildings.find(b=>Math.abs(b.x-point.x)<b.w/2+10&&point.y>b.y-b.h*.65-12&&point.y<b.y+b.h/2+26);return b?{kind:'building',id:b.id}:null;
  }
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,px:panX,py:panY,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){panX=clamp(drag.px+dx,-cw*.6,cw*.6);panY=clamp(drag.py+dy,-ch*.6,ch*.6);$('map-tooltip').hidden=true;}return;}const point=worldAt(e);hover=hit(point);const tip=$('map-tooltip');tip.hidden=!hover;if(hover){tip.textContent=hover.kind==='person'?sim.person(hover.id).name+' · '+sim.person(hover.id).action:sim.building(hover.id).name;tip.style.left=Math.max(8,Math.min(point.sx+14,cw-230))+'px';tip.style.top=Math.max(8,Math.min(point.sy-30,ch-50))+'px';}});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const h=hit(worldAt(e));if(h)h.kind==='person'?selectPerson(h.id):selectBuilding(h.id);}drag=null;});canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('pointerleave',()=>{hover=null;$('map-tooltip').hidden=true;});
  canvas.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom=clamp(zoom+(e.deltaY<0?.1:-.1),.85,2.3);},{passive:false});
  let last=performance.now();function frame(now){const dt=Math.min(.2,(now-last)/1000);last=now;if(!paused&&!document.hidden&&!document.querySelector('dialog[open]'))sim.advance(dt*18*speed);if(now-lastUI>750){updateUI();lastUI=now;}draw(now);requestAnimationFrame(frame);}
  updateUI(true);requestAnimationFrame(frame);
  if(loadError)toast('Сохранение не удалось прочитать. Открыт новый город.');
  window.danzig={get sim(){return sim;},get paused(){return paused;},get speed(){return speed;},pause(){paused=true;updateUI(true);},advance(minutes){sim.advance(minutes);updateUI(true);},selectPerson,selectBuilding};
})();
