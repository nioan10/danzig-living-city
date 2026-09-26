(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const A=node?require('./analytics.js'):root.DanzigAnalytics;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number.isFinite(x)?(Math.abs(x)<.05?0:x).toLocaleString('ru-RU',{maximumFractionDigits:1}):'—';
  const colors=['#426e62','#b16c3d','#6f75a0','#b29936'];
  const TOPICS={life:'Население и жизнь',money:'Деньги',work:'Труд и застройка',goods:'Товары',society:'Общество',learning:'Поколения'};
  const time=at=>`День ${Math.floor(at/1440)+1} · ${String(Math.floor(at%1440/60)).padStart(2,'0')}:${String(Math.floor(at%60)).padStart(2,'0')}`;
  const series=(key,label,unit)=>({key,label,unit});
  const sum=xs=>xs.reduce((a,b)=>a+b,0);
  function trend(rows,key){const values=rows.map(p=>A.value(p,key)).filter(v=>v!==null);return values.length>1?values.at(-1)-values[0]:null;}
  function rateRows(rows,keys){const result=rows.map(p=>({at:p.at}));for(const key of keys)A.rates(rows,key).forEach((p,i)=>result[i][key.replaceAll('.','_')]=p.value);return result;}
  function readout(plot,index){const p=plot.rows[index];return `<b>${time(p.at)}</b>${plot.series.map((q,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(q.label)}: <strong>${n(A.value(p,q.key))}</strong> ${esc(q.unit||'')}</span>`).join('')}`;}
  function chart(ctx,title,note,rows,lines,options={}){
    const recorded=rows.map(p=>lines.some(q=>A.value(p,q.key)!==null)),firstIndex=recorded.indexOf(true),lastIndex=recorded.lastIndexOf(true);
    const data=firstIndex<0?[]:rows.slice(firstIndex,lastIndex+1),id='stat-plot-'+ctx.plots.length;
    const plot={rows:data,series:lines};ctx.plots.push(plot);
    const vals=data.flatMap(p=>lines.map(q=>A.value(p,q.key))).filter(v=>v!==null);
    const lo=Math.min(0,...vals),hi=Math.max(1,...vals),step=10**Math.floor(Math.log10((hi-lo)/4));
    const interval=[1,2,5,10].map(x=>x*step).find(x=>x>=(hi-lo)/4)||step*10;
    const min=Math.floor(lo/interval)*interval,max=Math.ceil(hi/interval)*interval,range=max-min||1;
    const first=data[0]?.at??0,last=data.at(-1)?.at??first;
    const x=t=>data.length<2?287:52+(t-first)/Math.max(1,last-first)*470,y=v=>174-(v-min)/range*152;
    const grid=Array.from({length:5},(_,i)=>{const v=min+range*i/4;return `<path d="M52 ${y(v)}H522" class="stat-gridline"/><text x="44" y="${y(v)+4}" text-anchor="end">${n(v)}</text>`;}).join('');
    const paths=lines.map((q,j)=>{
      const segments=[];let part=[];for(const p of data){const v=A.value(p,q.key);if(v===null){if(part.length)segments.push(part);part=[];}else part.push([x(p.at),y(v)]);}if(part.length)segments.push(part);
      const color=colors[j%colors.length];
      if(options.bars)return data.map(p=>{const v=A.value(p,q.key);if(v===null)return '';const w=Math.min(22,420/Math.max(1,data.length)/lines.length),offset=(j-(lines.length-1)/2)*w;return `<rect x="${x(p.at)+offset-w*.42}" y="${Math.min(y(v),y(0))}" width="${w*.84}" height="${Math.max(.6,Math.abs(y(v)-y(0)))}" rx="1.5" fill="${color}"/>`;}).join('');
      return segments.map(segment=>`<polyline points="${segment.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"${j===1?' stroke-dasharray="6 3"':''}/>${segment.length===1?`<circle cx="${segment[0][0]}" cy="${segment[0][1]}" r="4" fill="${color}"/>`:''}`).join('');
    }).join('');
    const legend=lines.map((q,i)=>{const recorded=data.filter(p=>A.value(p,q.key)!==null),delta=trend(recorded,q.key);return `<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(q.label)}</span><b>${n(recorded.length?A.value(recorded.at(-1),q.key):null)} <small>${esc(q.unit||'')}</small></b>${delta!==null&&!options.bars?`<small>Δ ${delta>0?'+':''}${n(delta)}</small>`:''}</div>`;}).join('');
    return `<article class="stat-chart${options.wide?' stat-wide':''}"><header><h3>${esc(title)}</h3><p>${esc(note)}</p></header><div class="stat-legend">${legend}</div>${data.length?`<svg viewBox="0 0 550 210" role="img" aria-label="${esc(title)}: ${data.length} наблюдений" data-stat-hover="${ctx.plots.length-1}">${grid}${paths}<line class="stat-cursor" x1="${x(last)}" x2="${x(last)}" y1="18" y2="177"/><text x="52" y="200">День ${Math.floor(first/1440)+1}</text><text x="522" y="200" text-anchor="end">${last!==first?'День '+(Math.floor(last/1440)+1):'Одно наблюдение'}</text></svg><div class="stat-inspect"><label for="${id}">Момент наблюдения</label><input id="${id}" type="range" min="0" max="${data.length-1}" value="${data.length-1}" data-stat-point="${ctx.plots.length-1}" aria-label="Точка графика «${esc(title)}»"${data.length<2?' disabled':''}><output for="${id}" class="stat-readout" aria-live="polite">${readout(plot,data.length-1)}</output></div><small class="stat-coverage">${time(first)} — ${time(last)} · ${data.length} точек${data.length<2?' · линия появится после следующего наблюдения':''}${options.bars?' · текущий день ещё не завершён':''}</small>`:'<p class="stat-empty">Пока нет измерений. Для скорости изменения нужны хотя бы две точки с интервалом между ними.</p>'}</article>`;
  }
  function bars(title,note,rows,unit='чел.'){
    const max=Math.max(1,...rows.map(r=>r.value??0));
    return `<article class="stat-chart stat-distribution"><header><h3>${esc(title)}</h3><p>${esc(note)}</p></header>${rows.length?rows.map((r,i)=>`<div class="stat-bar-row"><div><span>${esc(r.label)}</span><b>${n(r.value)} ${esc(unit)}</b></div><div class="stat-track"><i style="width:${Math.max(0,(r.value||0)/max*100)}%;background:${colors[i%colors.length]}"></i></div>${r.note?`<small>${esc(r.note)}</small>`:''}</div>`).join(''):'<p class="stat-empty">Нет данных для распределения.</p>'}</article>`;
  }
  function kpi(title,value,detail){return `<div><small>${esc(title)}</small><b>${esc(value)}</b><span>${esc(detail)}</span></div>`;}
  function render(dashboard){
    const s=dashboard.sim,topic=dashboard.statsTopic||'life',period=dashboard.statsPeriod||'30',good=dashboard.statsGood||'bread';
    const rows=A.points(s,period),now=rows.at(-1),ctx={plots:[]},p=s.alive,l=s.living;
    const from=period==='all'?0:s.now-Number(period)*1440;
    const c=(title,note,lines,opts={})=>chart(ctx,title,note,rows,lines,opts);
    const r=(title,note,keys,labels,unit)=>chart(ctx,title,note,rateRows(rows,keys),keys.map((k,i)=>series(k.replaceAll('.','_'),labels[i],unit)));
    let graphs='',cards='';
    if(topic==='life'){
      const change=trend(rows,'population');
      cards=kpi('Жителей сейчас',n(now.population),change===null?'Первое наблюдение':`Изменение за доступный период: ${change>0?'+':''}${n(change)}`)+kpi('Сытость',n(now.hunger)+'%','Среднее по находящимся в городе')+kpi('В тесноте',n(now.crowded),'Живут в домах сверх вместимости')+kpi('Болеют',n(now.sick),'Жители в городе');
      graphs=c('Население и жильё','Вместимость — комфортное число мест, а не запрет на заселение.',[series('population','В городе','чел.'),series('capacity','Мест в домах','мест'),series('away','На службе','чел.')])+
        c('Самочувствие города','Средние показатели жителей, находящихся в городе.',[series('happiness','Благополучие','%'),series('hunger','Сытость','%'),series('health','Здоровье','%')])+
        c('Кому тяжело','Голодными считаются жители с сытостью ниже 25%.',[series('hungry','Голодны','чел.'),series('sick','Болеют','чел.'),series('crowded','Живут в тесноте','чел.')])+
        bars('Возрастная структура','Срез сейчас · все живые жители, включая службу.',[['До 6 лет',0,6],['6–15 лет',6,16],['16–34 года',16,35],['35–64 года',35,65],['65 лет и старше',65,Infinity]].map(([label,a,b])=>({label,value:l.filter(q=>q.age>=a&&q.age<b).length})))+
        r('Пополнение и утраты','Среднее за интервал между наблюдениями, в пересчёте на день.', ['births','deaths','immigrants'],['Рождения','Смерти','Переселенцы'],'чел./день')+
        c('Переезды семей','Накопленное число успешных переселений внутри города.',[series('moves','Переездов','')]);
    }
    if(topic==='money'){
      const accounts=A.accounts(s,period),income=sum(accounts.map(d=>d.income)),expenses=sum(accounts.map(d=>d.expenses)),adults=l.filter(q=>q.age>=16);
      cards=kpi('В казне',n(now.treasury)+' тал.','Текущий остаток')+kpi('Сальдо бюджета',n(income-expenses)+' тал.',`По журналу за ${accounts.length} дн., включая текущий`)+kpi('Медиана сбережений',n(now.medianCash)+' тал.','Личный кошелёк жителя от 16 лет')+kpi('Обязательства города',n(now.debt+now.arrears)+' тал.','Регион и отложенное содержание');
      graphs=c('Казна и обязательства','Долг региону и отложенные расходы показаны отдельно.',[series('treasury','Казна','тал.'),series('debt','Региону','тал.'),series('arrears','Содержание','тал.')])+
        chart(ctx,'Доходы и расходы по дням','Реальные операции казны. Журнал доступен максимум за последние 60 дней.',accounts,[series('income','Доходы','тал.'),series('expenses','Расходы','тал.')],{bars:true})+
        c('Где находятся деньги','Кошельки всех живых жителей, кассы производств и средства гильдий.',[series('personalCash','У жителей','тал.'),series('workshopCash','В мастерских','тал.'),series('guildCash','У гильдий','тал.')])+
        bars('Сбережения взрослых','Срез сейчас · личные деньги, без общего имущества семьи.',[['Нет денег',0,0],['До 10 талеров',0,10],['10–30 талеров',10,30],['30–100 талеров',30,100],['100 и более',100,Infinity]].map(([label,a,b],i)=>({label,value:adults.filter(q=>i===0?q.coins===0:i===1?q.coins>0&&q.coins<b:q.coins>=a&&q.coins<b).length})));
      const since=accounts[0]?.at/1440??s.day,book=s.accounts.days.filter(d=>d.day>=since),names=root.DanzigDashboard?.CATEGORIES||dashboard.categories||{};
      for(const [side,title] of [['income','Откуда поступают деньги'],['expenses','На что тратит ратуша']]){
        const totals={};for(const d of book)for(const [key,v]of Object.entries(d[side]))totals[key]=(totals[key]||0)+v;
        graphs+=bars(title,`Операции казны с дня ${since+1}, включая текущий день.`,Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([key,value])=>({label:names[key]||key,value})), 'тал.');
      }
    }
    if(topic==='work'){
      cards=kpi('Заняты',n(now.employed),'Жители 16–64 лет с местом работы')+kpi('Без работы',n(now.jobless),'Жители 16–64 лет без места, не на службе')+kpi('Производств',n(now.workshops),'Построенные производственные дворы')+kpi('Средний навык',n(now.skill),'Все живые жители от 16 лет');
      graphs=c('Занятость','Жители 16–64 лет без военного назначения; место работы не означает работу в этот час.',[series('employed','Есть работа','чел.'),series('jobless','Без работы','чел.')])+
        c('Как растёт город','Построенные здания, производства и незавершённые стройки.',[series('buildings','Зданий',''),series('workshops','Производств',''),series('sites','Строек','')])+
        c('Ремесленный опыт','Средний навык живых взрослых. Смена поколений тоже меняет среднее.',[series('skill','Навык','')]);
      const jobs=new Map();for(const q of p.filter(q=>q.jobId)){const b=s.building(q.jobId),label=root.Danzig?.TYPES[b?.type]?.name||b?.type||'Другая работа';jobs.set(label,(jobs.get(label)||0)+1);}
      graphs+=bars('Кто где занят','Срез сейчас · все жители с назначенным местом работы.',[...jobs].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value})));
    }
    if(topic==='goods'){
      const name=root.Danzig?.GOODS[good]||good,produced=trend(rows,'produced.'+good),consumed=trend(rows,'consumed.'+good);
      cards=kpi('Товар',name,'Выберите товар над графиками')+kpi('Всего в городе',n(now.goods[good]),'Дворы, городской склад, сумки и грузы')+kpi('Произведено',n(produced),'Изменение счётчика за доступный период')+kpi('Израсходовано',n(consumed),'Изменение счётчика за доступный период');
      graphs=c('Запасы: '+name,'Суммарные остатки во всём городе, включая товары в пути.',[series('goods.'+good,'Запас','ед.')])+
        c('Цена: '+name,'Базовая внутренняя котировка. Наценки отдельных продавцов в неё не входят.',[series('prices.'+good,'Цена','тал./ед.')])+
        r('Выпуск и расход: '+name,'Еда, сырьё по рецептам и износ инструментов; среднее за интервал. Без стройки, потерь и экспорта.',['produced.'+good,'consumed.'+good],['Производство','Расход'],'ед./день')+
        bars('Запасы всех товаров','Срез сейчас · единицы разных товаров не равноценны.',Object.entries(now.goods).sort((a,b)=>b[1]-a[1]).map(([key,value])=>({label:root.Danzig?.GOODS[key]||key,value})),'ед.');
    }
    if(topic==='society'){
      cards=kpi('Договоров',n(now.agreements),'Действующие и просроченные, без предложений')+kpi('Просрочено',n(now.overdue),'Неисполненные обязательства')+kpi('Связей доверия',n(now.trust),'Направленные отношения от 25, между живыми')+kpi('Исполнений договоров',n(now.fulfilled),'Полные исполнения, зафиксированные в журнале');
      graphs=c('Договорённости','Просроченные входят в общее число договоров.',[series('agreements','Незавершённые',''),series('overdue','Просроченные','')])+
        c('Доверие между людьми','Отношение А к Б и отношение Б к А учитываются отдельно. Порог доверия: 25.',[series('trust','Направленных связей','')])+
        r('Деньги по договорённостям','Займы и вклады; возвраты включают расчёты из наследства. Среднее за интервал.',['lent','repaid'],['Передано','Возвращено'],'тал./день');
      const goals=root.DanzigMind?.GOALS||{};
      graphs+=bars('К чему стремятся горожане','Срез сейчас · длительные намерения находящихся в городе.',Object.entries(goals).map(([key,label])=>({label,value:p.filter(q=>q.intention?.goal===key).length})));
    }
    if(topic==='learning'){
      const learning=s.people.map(q=>q.learning||{}),success=sum(learning.map(q=>q.successes||0)),fails=sum(learning.map(q=>q.failures||0));
      cards=kpi('Поколений',n(now.generations),'Представленных во всей истории города')+kpi('Удачных дел',success+fails?n(success/(success+fails)*100)+'%':'—','Доля успехов среди завершённых попыток')+kpi('Уроков в семье',n(now.lessons),'Накопленный опыт обучения у родителей')+kpi('Средний навык',n(now.skill),'Все живые жители от 16 лет');
      graphs=r('Опыт, полученный в делах','Частота успешных и неудачных завершений планов; среднее за интервал.',['successes','failures'],['Успехи','Ошибки'],'дел/день')+
        c('Передача опыта в семье','Накопленное число уроков, которые дети получили от родителей.',[series('lessons','Уроки','')]);
      const groups=[...new Set(s.people.map(q=>q.learning?.generation||0))].sort((a,b)=>a-b).map(g=>({g,all:s.people.filter(q=>(q.learning?.generation||0)===g),living:l.filter(q=>(q.learning?.generation||0)===g)}));
      graphs+=bars('Живые поколения','Срез сейчас · поколение определяется родством, а не возрастом.',groups.map(g=>({label:'Поколение '+(g.g+1),value:g.living.length,note:`Всего в истории: ${g.all.length}`})))+
        bars('Навыки поколений','Срез сейчас · среднее только по живым взрослым; возраст влияет на накопленный опыт.',groups.map(g=>{const a=g.living.filter(q=>q.age>=16);return {label:'Поколение '+(g.g+1),value:a.length?sum(a.map(q=>q.skill))/a.length:null,note:a.length?`${a.length} взрослых`:'Пока нет живых взрослых'};}),'');
    }
    dashboard.statsPlots=ctx.plots;
    const events=(s.events||[]).filter(e=>e.importance==='major'&&e.day*1440+(e.minute||0)>=from).slice(0,8);
    return `<section class="statistics-workspace"><div class="stat-toolbar"><div><span class="eyebrow">ГОРОДСКАЯ ОБСЕРВАТОРИЯ</span><h3>История в графиках</h3></div><label>Период <select data-stat-period aria-label="Период графиков">${[['7','7 дней'],['30','30 дней'],['90','90 дней'],['all','Вся история']].map(([v,t])=>`<option value="${v}"${period===v?' selected':''}>${t}</option>`).join('')}</select></label></div><nav class="stat-topics" aria-label="Темы графиков">${Object.entries(TOPICS).map(([key,label])=>`<button data-stat-topic="${key}" aria-pressed="${topic===key}">${label}</button>`).join('')}</nav><p class="stat-history-note">Новые показатели записываются с ${time(s.analytics?.since??s.now).replace('День','дня')}, каждые 6 игровых часов. Подробная история — последние 180 дней, более ранняя хранится с укрупнённым шагом. Старые графики населения и казны используют доступный архив. Δ — изменение между первой и последней доступной точкой.</p>${topic==='goods'?`<label class="stat-good">Товар <select data-stat-good aria-label="Товар для графиков">${Object.entries(root.Danzig?.GOODS||now.goods).map(([key,label])=>`<option value="${key}"${good===key?' selected':''}>${esc(label)}</option>`).join('')}</select></label>`:''}<div class="stat-kpis">${cards}</div><div class="stat-chart-grid">${graphs}</div><details class="stat-events"><summary>Значимые события периода · ${events.length}${events.length===8?' последних':''}</summary><p>Из сохранившейся хроники. Совпадение по времени само по себе не доказывает причину изменения графика.</p>${events.map(e=>`<div><time>${time(e.day*1440+(e.minute||0))}</time><span>${esc(e.title||e.text)}</span></div>`).join('')||'<p>В доступной хронике нет значимых событий за выбранный период.</p>'}</details></section>`;
  }
  function bind(dashboard){
    const root=dashboard.root;
    const inspect=input=>{const plot=dashboard.statsPlots?.[Number(input.dataset.statPoint)];if(!plot?.rows.length)return;const index=Number(input.value),card=input.closest('.stat-chart'),p=plot.rows[index];input.setAttribute('aria-valuetext',time(p.at));card.querySelector('output').innerHTML=readout(plot,index);const x=plot.rows.length<2?287:52+(p.at-plot.rows[0].at)/Math.max(1,plot.rows.at(-1).at-plot.rows[0].at)*470;const line=card.querySelector('.stat-cursor');line.setAttribute('x1',x);line.setAttribute('x2',x);};
    root.addEventListener('click',e=>{const b=e.target.closest('[data-stat-topic]');if(!b)return;dashboard.statsTopic=b.dataset.statTopic;dashboard.renderBody();root.querySelector(`[data-stat-topic="${dashboard.statsTopic}"]`)?.focus({preventScroll:true});});
    root.addEventListener('change',e=>{const select=e.target;if(select.matches('[data-stat-period],[data-stat-good]')){const period=select.hasAttribute('data-stat-period');dashboard[period?'statsPeriod':'statsGood']=select.value;dashboard.renderBody();root.querySelector(period?'[data-stat-period]':'[data-stat-good]')?.focus({preventScroll:true});}});
    root.addEventListener('input',e=>{if(e.target.matches('[data-stat-point]'))inspect(e.target);});
    root.addEventListener('pointermove',e=>{const svg=e.target.closest('svg[data-stat-hover]');if(!svg||e.pointerType==='touch')return;const plot=dashboard.statsPlots?.[Number(svg.dataset.statHover)];if(!plot?.rows.length)return;const rect=svg.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((e.clientX-rect.left)/rect.width*550-52)/470)),at=plot.rows[0].at+fraction*(plot.rows.at(-1).at-plot.rows[0].at);let index=0;for(let i=1;i<plot.rows.length;i++)if(Math.abs(plot.rows[i].at-at)<Math.abs(plot.rows[index].at-at))index=i;const input=svg.closest('.stat-chart').querySelector('input');input.value=index;inspect(input);});
  }
  const api={render,bind,chart,bars,trend,rateRows,readout};if(node)module.exports=api;else root.DanzigStatisticsView=api;
})(typeof window!=='undefined'?window:globalThis);
