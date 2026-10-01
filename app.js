(() => {
  'use strict';
  const {Simulation,TYPES,GOODS,World,clamp}=Danzig;
  const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEMO=new URLSearchParams(location.search).get('demo')==='1';
  const SAVE='danzig-city-v2';let sim,loadError=false,migrated=false;
  try{const saved=DEMO?null:localStorage.getItem(SAVE)||localStorage.getItem('danzig-city-v1');migrated=Boolean(saved&&JSON.parse(saved).version===1);sim=saved?Simulation.fromJSON(JSON.parse(saved)):new Simulation();}catch{sim=new Simulation();loadError=true;}
  let paused=true,speed=1,tab='summary',personId=sim.mayorId||1,buildingId='bakery',lotId=null,search='',personView='mind',lastUI=0,toastTimer,eventFilter='all',focusedIncident=null;
  const canvas=$('map');
  const cityMap=new DanzigMap(canvas,()=>sim,()=>({tab,person:personId,building:buildingId,lot:lotId,paused}),h=>{closeWideMap();if(h.kind==='person')selectPerson(h.id);else if(h.kind==='lot')selectLot(h.id);else selectBuilding(h.id);});
  const dashboard=new DanzigDashboard(()=>sim,()=>{updateUI(true);save();},selectPerson);
  const report=new DanzigReportView(()=>sim,()=>{paused=false;timeBudget=0;updateUI(true);save();toast('История города продолжается');});
  const portrait=p=>{const adult=p.age>=16,gray=p.age>60,skin=['#d6b98b','#cba57f','#dfc599'][p.id%3],cloth=['#71876a','#95774e','#718b88','#7c7291','#9d795c'][p.id%5],hair=gray?'#b1b09d':['#635c45','#7e643e','#4c4f3c'][p.id%3];return `<span class="avatar"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#dee3cf"/><path d="M6 64Q8 43 25 43L39 43Q56 44 59 64" fill="${cloth}"/><path d="M26 40L38 40L39 50L32 55L25 49Z" fill="${skin}"/><ellipse cx="32" cy="29" rx="${adult?13:11}" ry="17" fill="${skin}"/><path d="M18 28Q14 10 31 9Q49 9 46 28L41 20L25 20Z" fill="${hair}"/>${p.sex==='f'?`<path d="M18 23L13 43L23 46L24 25M44 23L50 44L41 47L40 24" fill="${hair}"/>`:''}<path d="M25 29h3M36 29h3" stroke="#5e5f49" stroke-width="1.7"/><path d="M29 37Q32 39 35 37" fill="none" stroke="#ad8061" stroke-width="1.3"/>${p.id===sim.mayorId?'<path d="M16 20L21 9L43 9L49 20Z" fill="#455b43"/><path d="M16 20H49" stroke="#b4a471" stroke-width="3"/>':''}</svg></span>`;};
  const toast=text=>{clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);};
  const money=n=>Math.floor(n).toLocaleString('ru-RU');
  const clock=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  const need=(label,v)=>`<div class="need"><span>${label}</span><div class="bar"><i class="${v<30?'low':''}" style="width:${clamp(v)}%"></i></div><span>${Math.round(v)}%</span></div>`;
  const personButton=(p,compact=false)=>`<button class="person-row ${p.id===personId?'selected':''}" data-person="${p.id}">${portrait(p)}<span><strong>${esc(p.name)}</strong><small>${esc(p.role)}${p.sick?' · болеет':''}</small></span><span class="row-age">${p.age} л.</span></button>`;
  function selectPerson(id){const p=sim.person(id);if(!p)return;if(cityMap.followId!==p.id)cityMap.followId=null;personId=p.id;tab='people';updateUI(true);}
  document.addEventListener('show-city-building',e=>{selectBuilding(e.detail);const b=sim.building(e.detail);cityMap.focus(b.x,b.y);});
  function selectBuilding(id){lotId=null;buildingId=id;const b=sim.building(id);if(b&&!cityMap.matches(b)){cityMap.filter='all';$('map-layer').value='all';}tab='buildings';updateUI(true);}
  function renderPeople(){
    const p=sim.person(personId)||sim.alive[0];if(!p)return '<h2 class="city-title">Город опустел</h2><p class="muted">Пригласите переселенцев в разделе «Расширение», чтобы снова заселить улицы.</p>';
    const home=sim.building(p.homeId),job=sim.building(p.jobId),spouse=sim.person(p.spouseId),friend=sim.person(p.friendId),family=sim.alive.filter(q=>q.parents.includes(p.id));
    const housingInfo=DanzigHousing.census(sim).get(p.homeId);
    const state=p.alive?(p.path.length?'В пути':p.action):'В памяти города';
    return `<div class="panel-eyebrow"><span>ГОРОЖАНИН № ${String(p.id).padStart(3,'0')}</span><span class="status-tag">${esc(state)}</span></div>
      <div class="person-heading">${portrait(p)}<div><h2>${esc(p.name)}</h2><p>${p.age} лет · ${esc(p.role)}<br>${p.id===sim.mayorId?'Избранный глава города':p.age<16?'Юный житель Данцига':'Горожанин Данцига'}</p></div></div>
      <div class="traits">${p.traits.map(t=>`<span class="trait">${esc(t)}</span>`).join('')}</div>
      ${p.alive?`<div class="housing-note"><b>${esc(DanzigTitles.ranks[p.title?.rank]?.name||'Без личного титула')} · ${esc(DanzigHousing.estates[p.estate])} · ${esc(DanzigHousing.district(home).name)}</b><span>Аренда земли: ${DanzigHousing.rent(sim,p).toFixed(2)} тал./день · запас 12 тал. защищён</span><b>Дом: ${housingInfo.present} жильцов · комфортно ${housingInfo.capacity}</b><span>${DanzigHousing.conditions(housingInfo)} ${p.relocation?'Семья переезжает.':p.housingWish?.to?'Ищет возможность переехать в '+esc(sim.building(p.housingWish.to).name)+'.':p.homeProject?esc(DanzigHousingProjects.describe(sim,p)):p.housingWish?'Хочет переехать; подходящего дома пока нет.':''}</span></div>`:''}
      <div class="person-modes"><button data-person-view="mind" class="${personView==='mind'?'active':''}" aria-pressed="${personView==='mind'}">Планы и память</button><button data-person-view="life" class="${personView==='life'?'active':''}" aria-pressed="${personView==='life'}">Повседневность</button></div>
      ${personView==='mind'?renderMind(p):`<blockquote class="quote">«${esc(p.reason)}»</blockquote>
      <div class="section-label">САМОЧУВСТВИЕ <span>${p.sick?'БОЛЕЕТ':p.health<40?'ТРЕВОЖНО':'В НОРМЕ'}</span></div>
      ${need('Сытость',p.hunger)}${need('Энергия',p.energy)}${need('Общение',p.social)}${need('Настроение',p.mood)}
      <div class="detail-rows"><div class="detail-row"><span>Дом</span><b><button class="inline-link" data-building="${home.id}">${esc(home.name)}</button></b></div>
      <div class="detail-row"><span>Ремесло</span><b>${job?`<button class="inline-link" data-building="${job.id}">${esc(job.name)}</button>`:p.age<16?'Ещё растёт':'Свободный горожанин'}</b></div>
      <div class="detail-row"><span>Сбережения</span><b>${money(p.coins)} тал. <span class="muted"> / +${p.earned.toFixed(1)} за день</span></b></div>
      ${p.fiscalToday?`<div class="detail-row"><span>Заработок за день ${p.fiscalToday.day+1}</span><b>До удержаний ${p.fiscalToday.gross.toFixed(1)} · налог ${p.fiscalToday.tax.toFixed(1)} · десятина ${p.fiscalToday.tithe.toFixed(1)} тал.</b></div>`:''}
      <div class="detail-row"><span>Репутация</span><b>${Math.round(p.reputation)} / 100</b></div>
      <div class="detail-row"><span>Семья</span><b>${spouse?.alive?`<button class="inline-link" data-person="${spouse.id}">${esc(spouse.name)}</button>`:p.age<16?'Живёт с родителями':'Не в браке'}${family.length?' · детей: '+family.length:''}</b></div>
      ${friend?.alive?`<div class="detail-row"><span>Близкий друг</span><b><button class="inline-link" data-person="${friend.id}">${esc(friend.name)}</button></b></div>`:''}</div>
      `}
      <div class="activity"><span class="activity-icon">${p.path.length?'↗':'◷'}</span><div>${p.path.length&&!p.absence?'Идёт: ':''}${esc(p.absence?p.action:p.path.length?sim.building(p.goal).name:p.action)}<small>${p.alive?'Сейчас · '+clock(sim.minute):'История этого жителя завершена'}</small></div></div>
      <button class="minor-button" data-locate="${p.id}">Найти на карте ↗</button>
      <button class="minor-button" data-follow="${p.id}" ${p.absence?.status==='away'?'disabled':''}>${cityMap.followId===p.id?'Перестать следить':'Следить за жителем'}</button>
      <div class="population-head"><div class="section-label">ЖИТЕЛИ ГОРОДА</div><span class="count-label">${sim.alive.length}</span></div>
      <input id="people-search" class="search" placeholder="Найти имя или ремесло…" aria-label="Найти жителя" value="${esc(search)}"><div class="people-list">${filteredPeople()}</div>`;
  }
  function renderMind(p){
    if(p.absence)return `<div class="mind-goal"><span class="eyebrow">СЛУЖБА РЕГИОНУ</span><h3>${esc(p.action)}</h3><p>${esc(p.reason)}</p><p>До окончания службы: ${Math.max(0,Math.ceil((p.absence.returnAt-sim.now)/1440))} дн.</p></div><p class="muted">${p.absence.status==='away'?'Сейчас за пределами города. Городские запасы и рабочее место не используются.':p.absence.status==='departing'?'Идёт по улицам к южным воротам.':'Возвращается домой по южной дороге.'}</p>`;
    return DanzigMindView.render(sim,p,renderLearning(p));
  }
  function renderLearning(p){const l=DanzigLearning.ensure(sim,p),values=Object.entries(l.values).sort((a,b)=>Math.abs(b[1].value)-Math.abs(a[1].value)).slice(0,4);return `<div class="learning-card"><div class="section-label">ОПЫТ И ОБУЧЕНИЕ <span>ПОКОЛЕНИЕ ${l.generation+1}</span></div><p>${l.successes} удачных планов · ${l.failures} неудач<br>Унаследовано предпочтений: ${l.inherited} · уроков семьи: ${l.lessons}</p>${values.map(([goal,v])=>`<div><span>${esc(v.title)}</span><b class="${v.value<0?'negative':''}">${v.value>=0?'+':''}${v.value.toFixed(1)}</b></div>`).join('')||'<small>Опыт появится после первых завершённых дел.</small>'}<small>Поправки к приоритетам целей. Неудачи снижают оценку, полезный результат повышает её.</small></div>`;}
  function filteredPeople(){const q=search.toLocaleLowerCase('ru');const people=sim.alive.filter(p=>(p.name+' '+p.role+' '+p.traits.join(' ')).toLocaleLowerCase('ru').includes(q));return people.length?people.map(p=>personButton(p)).join(''):'<div class="empty">Никого не нашлось.</div>';}
  function selectLot(id){lotMessage='';lotChoice='';lotId=id;tab='buildings';updateUI(true);}
  let lotMessage='',lotChoice='';
  function renderLot(){const l=World.expansionLots.find(l=>l.id===lotId);if(!l)return '';const b=sim.building(l.id);if(b){lotId=null;buildingId=b.id;return renderBuildings();}return `<div class="panel-eyebrow">СВОБОДНЫЙ УЧАСТОК ${l.id.slice(3)}</div><div class="building-detail"><h2>${esc(l.name)}</h2><p>Пунктир на карте показывает доступную землю. Подъезд к участку включён в стоимость строительства.</p></div><div class="land-options">${DanzigExpansion.options(sim,l).map(o=>`<span>${esc(o.name)} · ${o.cost} тал.</span>`).join('')}</div><p class="muted">Ратуша может построить здесь здание за городской счёт. Семейные гильдии подают отдельные заявки на частную стройку.</p><form id="map-build-form"><label>Назначение участка<select name="type">${DanzigExpansion.options(sim,l).map(o=>`<option value="${o.value}" ${lotChoice===o.value?'selected':''}>${esc(o.name)} · ${o.cost} тал. · от ${o.days} дн.</option>`).join('')}</select></label><button class="primary" type="submit" ${sim.conclusion?'disabled':''}>Построить за счёт города</button></form><p id="map-build-result" role="status">${esc(lotMessage)}</p><button class="minor-button" data-guilds>Заявки семей в ратуше ↗</button>`;}
  function renderBuildings(){
    if(lotId)return renderLot();
    const b=sim.building(buildingId),t=TYPES[b.type],workers=sim.workers(b.id),residents=sim.alive.filter(p=>p.homeId===b.id),recipe=sim.productionRecipe(b),inside=sim.occupants(b.id),housingInfo=b.type==='home'?DanzigHousing.census(sim).get(b.id):null;
    return `<div class="panel-eyebrow"><span>${esc(t.name.toUpperCase())}</span><span class="status-tag">${b.damaged?'ПОСЛЕ ПОЖАРА':b.closedUntil>sim.now?'ОСТАНОВЛЕНО':inside.length+' ЧЕЛ. ВНУТРИ'}</span></div><div class="building-detail">${b.construction?`<p class="ledger-notice">${b.construction.local?'Строительство · работа '+(b.construction.local.work/b.construction.local.required*100).toFixed(0)+'% · '+esc(b.construction.local.reason):'Строительство · ещё '+Math.max(0,(b.construction.until-sim.now)/1440).toFixed(1)+' дн.'}</p>`:''}<h2>${esc(b.name)}</h2><p class="muted">${esc(t.description)}</p></div>
    <p class="district-note"><b>${esc(DanzigHousing.district(b).name)}</b>${b.type==='home'?' · '+esc(DanzigResidences.spec(b).name):''} · сбор с двора ×${DanzigHousing.district(b).tax}${b.type==='home'?' · аренда земли '+(DanzigHousing.district(b).rent*DanzigResidences.spec(b).rent)+' тал./взрослого в день (I уровень)':''}</p>
    ${DanzigDevelopmentView.building(sim,b)}${DanzigLawPropertyView.building(sim,b)}
    ${recipe&&b.enterprise?`<div class="enterprise-note" style="--guild:${DanzigGuilds.owner(sim,b)?.color||'#849576'}"><b>${esc(DanzigGuilds.ownerName(sim,b))}</b>Цена ${GOODS[recipe.out].toLowerCase()}: ${sim.price(b,recipe.out).toFixed(2)} тал. · зарплата ${b.wage.toFixed(2)} тал./ч.<br>Остаток за прошлый день: ${b.enterprise.lastProfit.toFixed(1)} тал.<button class="minor-button" data-guilds>Владелец и конкуренты ↗</button></div>`:''}
    ${recipe?`<div class="production">${Object.entries(recipe.inputs).map(([k,n])=>n+' '+GOODS[k].toLowerCase()).join(' + ')||'Труд и природные ресурсы'} → ${recipe.amount} ${GOODS[recipe.out].toLowerCase()}<small>${!sim.isOpen(b)?'Работа приостановлена':sim.overstock(b)?'Склад заполнен: производство ждёт покупателей':!sim.canProduce(b)?'Нужно доставить сырьё':'Сегодня: '+b.today+' · всего: '+b.output}</small></div>`:''}
    ${housingInfo&&!b.construction?`<div class="housing-note"><b>Жильцов в городе: ${housingInfo.present} · комфортно ${housingInfo.capacity}</b><span>${DanzigHousing.conditions(housingInfo)} Прописано всего: ${housingInfo.members.length}, включая находящихся в армии.</span></div>`:''}
    <div class="section-label">ЗАПАСЫ ЭТОГО ДВОРА</div><div class="resource-grid">${Object.entries(b.stock).filter(([k,n])=>n>0||recipe?.inputs[k]).map(([k,n])=>`<div class="resource-row"><span>${GOODS[k]}</span><b>${Math.floor(n)}</b></div>`).join('')||'<p class="empty">Склад пуст</p>'}</div>
    ${b.type!=='home'?`<div class="detail-row"><span>Деньги мастерской</span><b>${money(b.cash)} тал.</b></div>`:''}
    ${b.type==='church'?`<button class="minor-button" data-fiscal>Десятина и бюджет церкви ↗</button>`:''}
    ${recipe?`<div class="detail-row"><span>Передано городу</span><b>${Object.entries(b.cityLevy||{}).map(([g,n])=>n.toFixed(1)+' '+GOODS[g].toLowerCase()).join(', ')||'Пока ничего'}</b></div><button class="minor-button" data-trade>Рыночные цены и городской сбор ↗</button>`:''}
    ${recipe?`<button class="minor-button" data-action="disrupt" data-target-building="${b.id}" ${b.closedUntil>sim.now?'disabled':''}>${b.closedUntil>sim.now?'Остановка ещё действует':'Остановить работу на сутки'}</button>`:''}
    ${b.damaged?`<button class="minor-button" data-action="repair" data-target-building="${b.id}">Восстановить это здание · 35 тал.</button>`:''}
    <div class="section-label">${b.type==='home'?'ЖИЛЬЦЫ':'РАБОТНИКИ'}<span>${b.type==='home'?residents.length:workers.length+' / '+sim.jobSlots(b)}</span></div>
    ${(b.type==='home'?residents:workers).map(p=>personButton(p,true)).join('')||`<p class="empty">${b.type==='home'?'Дом пока не заселён.':'Работников пока нет.'}</p>`}
    <div class="section-label">ЗДАНИЯ ГОРОДА<span>${sim.buildings.length}</span></div><div class="build-list">${sim.buildings.map(q=>`<button class="building-row ${q.id===b.id?'selected':''}" data-building="${q.id}"><span class="building-symbol">${TYPES[q.type].symbol}</span><span><strong>${esc(q.name)}</strong><small>${q.damaged?'Повреждено пожаром':q.type==='home'?sim.alive.filter(p=>p.homeId===q.id).length+' жильцов':TYPES[q.type].name}</small></span></button>`).join('')}</div>`;
  }
  function renderCity(){const mayor=sim.person(sim.mayorId),damaged=sim.buildings.filter(b=>b.damaged).length;return `<div class="panel-eyebrow"><span>ГОРОДСКОЙ СОВЕТ</span><span class="status-tag">${sim.season.toUpperCase()}</span></div><h2 class="city-title">Дела вольного города</h2><p class="muted">Маленькие решения меняют повседневную жизнь. Наблюдайте за последствиями.</p>
    <div class="detail-rows"><div class="detail-row"><span>Бургомистр</span><b>${mayor?`<button class="inline-link" data-person="${mayor.id}">${esc(mayor.name)}</button>`:'Вакантно'}</b></div><div class="detail-row"><span>Следующие выборы</span><b>Через ${12-sim.day%12} дн.</b></div><div class="detail-row"><span>Родилось / умерло</span><b>${sim.births} / ${sim.deaths}</b></div></div>
    <div class="fiscal-council"><div class="section-label">НАЛОГОВАЯ ПОЛИТИКА</div><p>${sim.fiscal.autoMayor?'Магистрат сам оценивает дефицит и меняет городские налоги.':'Ставки закреплены вашим указом.'}</p>${Object.entries(DanzigFinance.TAXES).map(([k,v])=>`<div class="detail-row"><span>${v.name}</span><b>${sim.fiscal.taxes[k].enabled?sim.fiscal.taxes[k].rate+'%':'Отменён'}</b></div>`).join('')}<div class="detail-row"><span>Десятина</span><b>${sim.fiscal.tithe.enabled?sim.fiscal.tithe.rate+'% · городу '+sim.fiscal.tithe.cityShare+'% сбора':'Отменена'}</b></div><button class="city-action" data-fiscal><span><strong>Налоги и церковная десятина</strong><small>Ввести или отменить сборы, изменить ставки и долю города</small></span><span>↗</span></button></div>
    <button class="city-action" data-development><span><strong>Магистрат и развитие дворов</strong><small>Ратуша ${DanzigDevelopment.level(sim.building('hall'))} уровня · должности, решения владельцев и улучшения</small></span><span>↗</span></button><button class="city-action" data-expand><span><strong>Расширение и новые жители</strong><small>Дома, мастерские и заселение предместий</small></span><span>↗</span></button><button class="city-action" data-trade><span><strong>Городской склад и внешняя торговля</strong><small>Доля выпуска, резерв еды, цены и экспорт</small></span><span>↗</span></button><div class="section-label">ЗАПАСЫ ВО ВСЕХ ДВОРАХ</div><div class="resource-grid">${Object.entries(GOODS).map(([id,name])=>`<div class="resource-row"><span>${name}</span><b>${money(sim.goods[id])}</b></div>`).join('')}</div>
    <div class="detail-row"><span>Доставок выполнено</span><b>${sim.deliveries}</b></div>
    <div class="section-label">ВАШЕ ВЛИЯНИЕ</div>
    <button class="city-action" data-action="food" ${sim.treasury<45||DanzigSystems.active(sim,'blockade')?'disabled':''}><span><strong>Закупить продовольствие</strong><small>${DanzigSystems.active(sim,'blockade')?'Закупка недоступна во время блокады':'75 порций хлеба из соседнего города'}</small></span><span>45 тал.</span></button>
    <button class="city-action" data-action="festival" ${sim.treasury<65||sim.festivalDay===sim.day?'disabled':''}><span><strong>${sim.festivalDay===sim.day?'Сегодня — городской праздник':'Устроить городской праздник'}</strong><small>Поднять настроение, собрать жителей на рынке</small></span><span>65 тал.</span></button>
    <button class="city-action" data-action="repair" ${sim.treasury<35||!damaged?'disabled':''}><span><strong>Помочь после пожара</strong><small>${damaged?'Повреждено зданий: '+damaged+'. Ремонт одного.':'Все здания в порядке'}</small></span><span>35 тал.</span></button>
    <button class="city-action" data-action="disrupt" data-target-building="mill"><span><strong>Остановить мельницу на сутки</strong><small>Проследить, как жители меняют планы и поставщиков</small></span><span>↗</span></button>
    <p class="muted" style="margin-top:20px;font-size:9px">Время сжато: 24 дня = год. Товары хранятся в отдельных дворах и перемещаются вместе с жителями. Это наблюдаемая модель города, а не точная реконструкция XV века.</p>`;}
  function renderLog(){return `<div class="panel-eyebrow"><span>ГОРОДСКАЯ ЛЕТОПИСЬ</span><span class="status-tag">ДЕНЬ ${sim.day+1}</span></div><h2 class="city-title">То, что останется</h2><p class="muted">Свадьбы, ремёсла, выборы и мелкие ссоры. История складывается из жизни людей.</p><div class="log-list">${sim.events.map(e=>`<article class="log-item"><small>ДЕНЬ ${e.day+1} · ${clock(e.minute)} · ${{politics:'СОВЕТ',family:'СЕМЬЯ',fire:'ПОЖАР',death:'ПАМЯТЬ',health:'ЗДОРОВЬЕ',economy:'ТОРГОВЛЯ',conflict:'ПРОИСШЕСТВИЕ',food:'ПРОДОВОЛЬСТВИЕ',festival:'ПРАЗДНИК',season:'СЕЗОН',career:'НОВАЯ РАБОТА',experiment:'ПЕРЕМЕНЫ'}[e.type]||'ЖИЗНЬ'}</small><p>${e.personId?`<button data-person="${e.personId}">${esc(e.text)}</button>`:esc(e.text)}</p></article>`).join('')}</div>`;}
  function eventCard(e){return `<article class="news-card ${esc(e.importance)}" data-news-id="${e.id}"><div class="news-meta"><span>${e.importance==='critical'?'СРОЧНО':esc(e.label||'Жизнь')}</span><time>День ${e.day+1} · ${clock(e.minute)}</time></div>${e.title?`<h3>${esc(e.title)}</h3>`:''}<p>${esc(e.text)}</p>${e.effects?`<div class="effect-tags">${e.effects.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="news-links">${e.buildingId?`<button data-event-place="${esc(e.buildingId)}">К месту события ↗</button>`:''}${e.personId?`<button data-person="${e.personId}">Открыть жителя ↗</button>`:''}</div></article>`;}
  function renderSummary(){
    const summary=sim.eventSummary(),chosen=sim.incidents?.find(e=>e.id===focusedIncident)||summary.active[0],list=sim.events.filter(e=>eventFilter==='all'||(eventFilter==='important'?e.importance!=='minor':e.importance==='minor'));
    return `<div class="summary-heading"><span class="eyebrow">ГОРОДСКОЙ ВЕСТНИК</span><h2>Что происходит<br>в Данциге</h2><p>Большие перемены и маленькие истории.</p></div>
      <div class="summary-numbers"><div><b>${summary.active.length}</b><span>происходит сейчас</span></div><div><b>${summary.major}</b><span>важных за день</span></div><div><b>${summary.minor}</b><span>обычных за день</span></div></div>
      ${summary.active.length?`<div class="section-label">СЕЙЧАС В ГОРОДЕ</div><div class="active-incidents">${summary.active.map(e=>`<button data-incident="${e.id}" class="${chosen?.id===e.id?'selected':''}"><i></i><span>${esc(e.title)}</span><small>${Math.max(0,Math.ceil(e.until-sim.now))} мин.</small></button>`).join('')}</div>`:''}
      ${chosen?`<section class="reaction-box"><div class="news-meta"><span>${chosen.status==='active'?'ГОРОД РЕАГИРУЕТ':'СОБЫТИЕ ЗАВЕРШЕНО'}</span><button data-event-place="${chosen.targetId}" aria-label="Показать место события">⌖</button></div><h3>${esc(chosen.title)}</h3><p>${chosen.reactions.length} жителей пересмотрели планы после известия.</p>${chosen.reactions.slice(0,4).map(r=>`<button class="reaction-person" data-person="${r.personId}"><span>${esc(r.name)}</span><small>${esc(r.title)} ↗</small></button>`).join('')}${chosen.reactions.length>4?`<small class="reaction-extra">И ещё ${chosen.reactions.length-4} жителей</small>`:''}</section>`:''}
      <div class="feed-heading"><h3>Лента города</h3><span>${sim.events.length} записей</span></div><div class="feed-filters" aria-label="Фильтр событий">${[['all','Все'],['important','Важные'],['ordinary','Повседневные']].map(([id,name])=>`<button data-filter="${id}" aria-pressed="${eventFilter===id}" class="${eventFilter===id?'active':''}">${name}</button>`).join('')}</div><div class="news-feed">${list.slice(0,25).map(eventCard).join('')||'<div class="feed-empty">Пока тихо.<br><span>Вызовите событие под картой или дайте городу пожить.</span></div>'}</div>`;
  }
  let renderedFeedIds=new Set();
  function feedNotice(){const button=$('feed-update'),reading=$('panel').scrollTop>48;button.hidden=tab!=='summary';if(button.hidden)return;const pending=sim.events.filter(e=>!renderedFeedIds.has(e.id)).length;button.disabled=!reading&&!pending;button.textContent=reading?(pending?'Новых событий: '+pending+' · Показать ↑':'Читаете историю · Вернуться к свежим ↑'):'Лента обновляется';}
  function updateUI(force=false){
    const targets=sim.buildings.filter(b=>TYPES[b.type].recipe&&!b.construction),picker=$('event-target');if(picker.dataset.targets!==targets.map(b=>b.id).join(',')){const selected=picker.value||'bakery';picker.innerHTML=targets.map(b=>`<option value="${b.id}" ${b.id===selected?'selected':''}>${esc(b.name)}</option>`).join('');picker.dataset.targets=targets.map(b=>b.id).join(',');}
    $('season').textContent=sim.season.toUpperCase()+' · '+sim.year;
    $('date').textContent=(sim.day%6+1)+' '+['марта','июня','сентября','декабря'][Math.floor(sim.day%24/6)];$('time').textContent=clock(sim.minute);$('weather').textContent=sim.weather;
    $('population').textContent=sim.alive.length;$('treasury').textContent=money(sim.treasury);$('food').textContent=money(sim.food);$('happiness').textContent=sim.happiness+'%';$('day-count').textContent='День '+(sim.day+1);
    $('population').title=`В городе: ${sim.alive.length}. Всего живых: ${sim.living.length}. На службе: ${sim.living.filter(p=>p.absence?.status==='away').length}.`;
    dashboard.refresh();
    updateMapFinder();$('latest-event').textContent=sim.events[0]?.text||'';$('map-status').textContent=sim.hour<6||sim.hour>=22?'Окна гаснут. Город засыпает':sim.hour<8?'Город просыпается':sim.hour<17?'Стучат молотки, работают печи':'Время вечерних разговоров';
    $('finish-simulation').textContent=sim.conclusion?'Итоги города':'Завершить';
    for(const el of document.querySelectorAll('#pause,#next-day,#observe-event,#open-event-lab,[data-speed]'))el.disabled=!!sim.conclusion;
    $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить симуляцию':'Приостановить симуляцию');
    document.querySelector('.live-label').innerHTML=`<i></i> ${sim.conclusion?'ИСТОРИЯ ЗАВЕРШЕНА':paused?'ВРЕМЯ ОСТАНОВЛЕНО':'ГОРОД ЖИВЁТ'}`;
    for(const b of document.querySelectorAll('[data-tab]')){b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));}
    for(const b of document.querySelectorAll('[data-speed]')){b.classList.toggle('active',Number(b.dataset.speed)===speed);b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===speed));}
    for(const b of document.querySelectorAll('[data-trigger]')){const active=DanzigEvents.active(sim,b.dataset.trigger);b.disabled=!!active||!!sim.conclusion;b.classList.toggle('running',!!active);b.querySelector('small').textContent=active?'Происходит сейчас':DanzigEvents.CATALOG.find(e=>e.id===b.dataset.trigger).duration/60+' ч. в городе';}
    const panel=$('panel'),key=tab+':'+(tab==='people'?personId+':'+personView:tab==='buildings'?lotId||buildingId:''),changed=panel.dataset.view!==key;
    feedNotice();
    if(!force&&!changed&&(tab==='summary'&&panel.scrollTop>48||['people-search','tax'].includes(document.activeElement?.id)||lotId&&!sim.building(lotId)||document.activeElement?.closest('#panel form')))return;
    const top=changed?0:panel.scrollTop,scroll={};for(const e of panel.querySelectorAll('.people-list,.build-list'))scroll[e.className]=e.scrollTop;
    const html=tab==='summary'?renderSummary():tab==='people'?renderPeople():tab==='buildings'?renderBuildings():tab==='city'?renderCity():renderLog();
    if(panel._renderedHTML!==html){
      const opened=changed?new Set():new Set([...panel.querySelectorAll('details[data-disclosure][open]')].map(e=>e.dataset.disclosure));
      panel.innerHTML=html;panel._renderedHTML=html;
      for(const e of panel.querySelectorAll('details[data-disclosure]'))e.open=opened.has(e.dataset.disclosure);
    }
    panel.dataset.view=key;panel.scrollTop=top;
    for(const e of panel.querySelectorAll('.people-list,.build-list'))e.scrollTop=changed?0:scroll[e.className]||0;
    if(tab==='summary')renderedFeedIds=new Set(sim.events.map(e=>e.id));feedNotice();
  }
  function save(show=false){if(DEMO){$('save-status').textContent='Пробный город · без сохранения';if(show)toast('Это пробный город. Ваше сохранение не меняется.');return;}try{localStorage.setItem(SAVE,JSON.stringify(sim));$('save-status').textContent='Сохранено · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});if(show)toast('История города сохранена в этом браузере');}catch{$('save-status').textContent='Сохранение недоступно';if(show)toast('Браузер не разрешил сохранить город');}}
  document.addEventListener('click',e=>{if(!sim.conclusion)return;const b=e.target.closest('[data-speed],[data-action],[data-trigger],#pause,#next-day,#observe-event,#open-event-lab,#fiscal-auto,#invite-family,#pay-region,#guild-council,[data-permit],[data-home-permit],[data-crisis],[data-custom-run],[data-custom-schedule],#tax');if(b){e.preventDefault();e.stopImmediatePropagation();toast('История завершена. Продолжить её можно из итогового отчёта.');}},true);
  document.addEventListener('submit',e=>{if(sim.conclusion){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-expand'))dashboard.open('expansion');
    if(b.hasAttribute('data-trade'))dashboard.open('trade');
    if(b.hasAttribute('data-development'))dashboard.open('development');
    if(b.hasAttribute('data-guilds'))dashboard.open('guilds');
    if(b.hasAttribute('data-fiscal'))dashboard.open('taxes');
    if(b.dataset.person)selectPerson(b.dataset.person);
    if(b.dataset.personView){personView=b.dataset.personView;updateUI(true);}
    if(b.dataset.locate){const p=sim.person(b.dataset.locate);cityMap.focus(p.x,p.y);canvas.scrollIntoView({behavior:'smooth',block:'center'});}
    if(b.dataset.follow){const p=sim.person(b.dataset.follow);cityMap.followId=cityMap.followId===p.id?null:p.id;if(cityMap.followId){cityMap.zoom=2;cityMap.focus(p.x,p.y);}updateUI(true);}
    if(b.dataset.building)selectBuilding(b.dataset.building);
    if(b.dataset.tab){tab=b.dataset.tab;updateUI(true);}
    if(b.dataset.speed){timeBudget=0;speed=Number(b.dataset.speed);paused=false;updateUI(true);}
    if(b.dataset.action){toast(sim.act(b.dataset.action,b.dataset.targetBuilding).message);updateUI(true);save();}
    if(b.dataset.filter){eventFilter=b.dataset.filter;$('panel').scrollTop=0;updateUI(true);}
    if(b.dataset.incident){focusedIncident=Number(b.dataset.incident);updateUI(true);}
    if(b.dataset.eventPlace){const place=sim.building(b.dataset.eventPlace);cityMap.focus(place.x,place.y);canvas.scrollIntoView({behavior:'smooth',block:'nearest'});}
    if(b.dataset.trigger){const result=sim.triggerEvent(b.dataset.trigger,$('event-target').value);$('event-response').textContent=result.message;if(result.ok){focusedIncident=result.incident.id;tab='summary';eventFilter='all';cityMap.reset();}else toast(result.message);updateUI(true);save();}
    if(b.hasAttribute('data-close'))b.closest('dialog').close();
  });
  $('feed-update').onclick=()=>{$('panel').scrollTop=0;updateUI(true);};
  $('panel').addEventListener('scroll',feedNotice,{passive:true});
  $('panel').addEventListener('input',e=>{if(e.target.id==='people-search'){search=e.target.value;$('panel').querySelector('.people-list').innerHTML=filteredPeople();}if(e.target.id==='tax')$('tax-value').textContent=e.target.value+'%';});
  $('panel').addEventListener('change',e=>{if(e.target.id==='tax'){sim.setTax(e.target.value);e.target.blur();updateUI(true);save();}});
  $('pause').onclick=()=>{paused=!paused;updateUI(true);};$('next-day').onclick=()=>{sim.nextMorning();updateUI(true);save();};$('open-log').onclick=()=>{tab='log';updateUI(true);};
  $('finish-simulation').onclick=()=>sim.conclusion?report.open():$('finish-dialog').showModal();
  $('confirm-finish').onclick=()=>{paused=true;timeBudget=0;sim.finish();$('finish-dialog').close();updateUI(true);save();report.open();};
  $('save').onclick=()=>save(true);$('help').onclick=()=>$('help-dialog').showModal();$('reset').onclick=()=>$('reset-dialog').showModal();
  $('open-stats').onclick=()=>dashboard.open();$('open-event-lab').onclick=()=>dashboard.openLab();
  $('confirm-reset').onclick=()=>{sim=new Simulation();personId=sim.mayorId;buildingId='bakery';search='';paused=false;speed=1;cityMap.reset();$('reset-dialog').close();updateUI(true);save();toast('У города начинается новая история');};
  function closeWideMap(){document.body.classList.remove('map-expanded');$('map-wide').setAttribute('aria-pressed','false');$('map-wide').textContent='Развернуть карту';}
  $('map-wide').onclick=()=>{const wide=document.body.classList.toggle('map-expanded');$('map-wide').setAttribute('aria-pressed',String(wide));$('map-wide').textContent=wide?'Свернуть карту':'Развернуть карту';};
  $('map-layer').onchange=e=>{cityMap.filter=e.target.value;document.querySelector('.map-scheme-note').textContent=cityMap.filter==='ownership'?'Л — личное · Г — гильдия · Ц — церковь · Р — город':'Город и предместья';if(cityMap.filter==='land'||cityMap.filter==='ownership'){cityMap.showLots=true;$('land-toggle').setAttribute('aria-pressed','true');}updateMapFinder();};
  for(const button of document.querySelectorAll('[data-map-view]'))button.onclick=()=>{cityMap.setMode(button.dataset.mapView);updateMapFinder();};
  $('rotate-left').onclick=()=>cityMap.three?.orbit(-Math.PI/8);$('rotate-right').onclick=()=>cityMap.three?.orbit(Math.PI/8);$('camera-tilt').onclick=()=>cityMap.three?.tilt();
  $('land-toggle').onclick=()=>{cityMap.showLots=!cityMap.showLots;$('land-toggle').setAttribute('aria-pressed',String(cityMap.showLots));};
  function updateMapFinder(){const entries=sim.buildings.filter(b=>cityMap.matches(b)).map(b=>({value:'building:'+b.id,text:TYPES[b.type].name+' — '+b.name}));if(cityMap.filter==='all'||cityMap.filter==='land'||cityMap.filter==='ownership')for(const l of World.expansionLots)if(!sim.building(l.id))entries.push({value:'lot:'+l.id,text:'Участок '+l.id.slice(3)+' · '+l.types.map(t=>DanzigPlan.names[t]).join(', ')});const html='<option value="">Выбрать объект…</option>'+entries.map(e=>`<option value="${e.value}">${esc(e.text)}</option>`).join('');if($('map-find').dataset.list!==html){$('map-find').innerHTML=html;$('map-find').dataset.list=html;}}
  $('map-find').onchange=e=>{const[kind,id]=e.target.value.split(':');if(!id)return;closeWideMap();if(kind==='lot'){selectLot(id);cityMap.focusLot(id);}else{selectBuilding(id);const b=sim.building(id);cityMap.focus(b.x,b.y);}};
  $('panel').addEventListener('submit',e=>{if(e.target.id!=='map-build-form')return;e.preventDefault();lotChoice=new FormData(e.target).get('type');const result=sim.startConstruction(lotId,lotChoice);lotMessage=result.message;if(result.ok){const id=lotId;selectBuilding(id);save();}updateUI(true);toast(result.message);});
  $('labels').onclick=()=>{cityMap.labels=!cityMap.labels;$('labels').setAttribute('aria-pressed',String(cityMap.labels));};
  $('routes').onclick=()=>{cityMap.routes=!cityMap.routes;$('routes').setAttribute('aria-pressed',String(cityMap.routes));};
  $('observe-event').onclick=()=>{sim.advance(30);paused=true;updateUI(true);save();$('event-response').textContent='Прошло 30 минут. Смотрите итоги и текущие планы жителей.';};
  $('event-target').innerHTML=sim.buildings.filter(b=>TYPES[b.type].recipe).map(b=>`<option value="${b.id}" ${b.id==='bakery'?'selected':''}>${esc(b.name)}</option>`).join('');
  $('event-controls').innerHTML=DanzigEvents.CATALOG.map(e=>`<button data-trigger="${e.id}" class="event-button ${e.tone}" title="${esc(e.description)}"><span class="event-icon">${e.icon}</span><span><b>${e.title}</b><small>${e.duration/60} ч. в городе</small></span></button>`).join('');
  $('zoom-in').onclick=()=>cityMap.zoomBy(.25);$('zoom-out').onclick=()=>cityMap.zoomBy(-.25);$('center').onclick=()=>cityMap.reset();
  document.addEventListener('keydown',e=>{if(sim.conclusion||['INPUT','TEXTAREA','BUTTON','SELECT'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();paused=!paused;updateUI(true);}if(['1','2','3','4','5','6','7','8'].includes(e.key)){speed={1:1,2:3,3:10,4:30,5:100,6:300,7:1000,8:3000}[e.key];paused=false;updateUI(true);}});
  window.addEventListener('beforeunload',()=>save());setInterval(()=>save(),30000);
  let last=performance.now(),timeBudget=0,measureStart=last,measureMinutes=0;
  function frame(now){const dt=Math.max(0,Math.min(.2,(now-last)/1000));last=now;const running=!sim.conclusion&&!paused&&!document.hidden&&!document.querySelector('dialog[open]');if(running){timeBudget=Math.min(1440,timeBudget+dt*18*speed);const until=performance.now()+12;while(timeBudget>=5&&performance.now()<until){sim.advance(5);timeBudget-=5;measureMinutes+=5;}}else timeBudget=0;if(now-measureStart>1000){$('actual-speed').textContent=running?'≈ '+Math.round(measureMinutes/((now-measureStart)/1000)/18)+'× фактически':'';measureStart=now;measureMinutes=0;}if(now-lastUI>750){updateUI();lastUI=now;}cityMap.draw(now);requestAnimationFrame(frame);}
  updateUI(true);requestAnimationFrame(frame);
  if(DEMO){$('save-status').textContent='Пробный город · без сохранения';document.querySelector('.prototype').textContent='ПРОБНЫЙ ГОРОД';}
  if(migrated){save();toast('Жители и семьи перенесены в обновлённый город. Старое сохранение сохранено отдельно.');}
  if(sim.conclusion)report.open();
  if(loadError)toast('Сохранение не удалось прочитать. Открыт новый город.');
  window.danzig={get sim(){return sim;},get paused(){return paused;},get speed(){return speed;},map:cityMap,pause(){paused=true;updateUI(true);},advance(minutes){sim.advance(minutes);updateUI(true);},selectPerson,selectBuilding};
})();
