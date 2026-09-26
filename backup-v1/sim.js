(function (root) {
  'use strict';
  const YEAR = 24, STEP = 5;
  const clamp = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
  const TYPES = {
    home: { name: 'Жилой дом', symbol: '⌂', color: '#8e6951', description: 'Семья отдыхает, растит детей и делит общий кров.' },
    farm: { name: 'Ферма', symbol: '♧', color: '#89935c', job: 'Земледелец', slots: 4, recipe: { out: 'grain', amount: 4, time: 65 }, description: 'Поля кормят город. Дождь и время года влияют на урожай.' },
    mill: { name: 'Мельница', symbol: '✣', color: '#9b8557', job: 'Мельник', slots: 3, recipe: { input: 'grain', cost: 2, out: 'flour', amount: 3, time: 60 }, description: 'Мельники превращают зерно в муку для городских пекарей.' },
    bakery: { name: 'Пекарня', symbol: '♨', color: '#ae7950', job: 'Пекарь', slots: 4, recipe: { input: 'flour', cost: 2, out: 'bread', amount: 5, time: 90 }, description: 'Тёплый хлеб — основа городского стола. Без муки печи остывают.' },
    smith: { name: 'Кузница', symbol: '⚒', color: '#75776e', job: 'Кузнец', slots: 2, recipe: { input: 'wood', cost: 2, out: 'tools', amount: 1, time: 180 }, description: 'Инструменты повышают производительность ремесленников. Дрова уходят в горн.' },
    wood: { name: 'Лесной двор', symbol: '♠', color: '#668068', job: 'Лесоруб', slots: 2, recipe: { out: 'wood', amount: 3, time: 100 }, description: 'Поставляет древесину для кузницы и городских мастерских.' },
    fish: { name: 'Рыбацкий двор', symbol: '≈', color: '#738f84', job: 'Рыбак', slots: 3, recipe: { out: 'fish', amount: 3, time: 110 }, description: 'Улов из гавани разнообразит еду и помогает пережить нехватку хлеба.' },
    tavern: { name: 'Трактир', symbol: '♜', color: '#9c7955', job: 'Трактирщик', slots: 2, description: 'После работы здесь знакомятся, мирятся и иногда ссорятся.' },
    church: { name: 'Церковь', symbol: '✝', color: '#878584', job: 'Священнослужитель', slots: 2, description: 'Службы укрепляют дух. Набожные жители приходят сюда чаще.' },
    hall: { name: 'Ратуша', symbol: '⚑', color: '#8e6960', job: 'Писарь', slots: 2, description: 'Здесь собирают налоги и заседает совет. Выборы бургомистра проходят каждые 12 дней.' },
    market: { name: 'Рынок', symbol: '◇', color: '#a99462', job: 'Торговец', slots: 2, description: 'Общий городской запас. Жители покупают еду, а мастера сбывают изделия за пределы города.' },
    clinic: { name: 'Лечебница', symbol: '+', color: '#8a9a76', job: 'Лекарь', slots: 1, description: 'Лекарь помогает заболевшим. Дети и пожилые особенно нуждаются в уходе.' },
    school: { name: 'Школа', symbol: '▤', color: '#9a8d70', job: 'Учитель', slots: 1, description: 'Дети от шести лет учатся, знакомятся и готовятся к взрослой жизни.' },
    dock: { name: 'Торговая пристань', symbol: '⚓', color: '#818b78', job: 'Портовый рабочий', slots: 2, description: 'Через порт идут поставки и торговля. Раз в три дня караван выкупает лишние припасы.' }
  };
  const GOODS = { grain: 'Зерно', flour: 'Мука', bread: 'Хлеб', fish: 'Рыба', wood: 'Древесина', tools: 'Инструменты' };
  const TRAITS = ['Трудолюбивый', 'Общительный', 'Набожный', 'Амбициозный', 'Добрый', 'Ленивый', 'Бережливый', 'Вспыльчивый', 'Замкнутый'];
  const FIRST = { m: ['Ганс', 'Мартин', 'Якоб', 'Петер', 'Никлас', 'Йоханн', 'Пауль', 'Георг', 'Лукас', 'Отто', 'Конрад', 'Матиас'], f: ['Анна', 'Грета', 'Марта', 'Эльза', 'Клара', 'Хелена', 'Агнес', 'Доротея', 'Мария', 'Урсула', 'София', 'Катерина'] };
  const LAST = ['Фогель', 'Беккер', 'Крюгер', 'Вебер', 'Фишер', 'Шульц', 'Мюллер', 'Шнайдер', 'Бауэр', 'Кох', 'Вольф', 'Брандт'];
  const ROADX = [180, 390, 610, 825], ROADY = [170, 355, 550, 705];
  class Simulation {
    constructor(seed = 1450) {
      this.seed = seed; this.day = 0; this.minute = 360; this.remainder = 0; this.tax = 12; this.treasury = 320;
      this.goods = { grain: 85, flour: 60, bread: 130, fish: 50, wood: 70, tools: 20 };
      this.people = []; this.buildings = []; this.events = []; this.nextId = 1; this.weather = 'Ясно'; this.festivalDay = -10; this.births = 0; this.deaths = 0; this.produced = 0;
      this.makeBuildings(); this.makePeople(); this.mayorId = this.people[0].id;
      this.people[0].role = 'Бургомистр'; this.people[0].jobId = 'hall'; this.people[0].reputation = 78;
      this.people[0].traits = ['Амбициозный', 'Общительный'];
      this.assignJobs();
      this.log('В городе начинается новая история. Ганс Фогель возглавляет городской совет.', 'politics', this.mayorId);
    }
    random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
    pick(a) { return a[Math.floor(this.random() * a.length)]; }
    get alive() { return this.people.filter(p => p.alive); }
    get food() { return Math.floor(this.goods.bread + this.goods.fish); }
    get happiness() { const p = this.alive; return p.length ? Math.round(p.reduce((n, x) => n + x.mood, 0) / p.length) : 0; }
    get year() { return 1450 + Math.floor(this.day / YEAR); }
    get season() { return ['Весна', 'Лето', 'Осень', 'Зима'][Math.floor(this.day % YEAR / 6)]; }
    get hour() { return Math.floor(this.minute / 60); }
    person(id) { return this.people.find(p => p.id === Number(id)); }
    building(id) { return this.buildings.find(b => b.id === id); }
    makeBuildings() {
      const add = (id, type, name, x, y, w = 65, h = 44) => this.buildings.push({ id, type, name, x, y, w, h, progress: 0, output: 0, today: 0, damaged: false, damageDay: -1, repairedDay: -1 });
      [[105,98],[285,98],[490,98],[105,269],[285,269],[105,757],[285,757],[490,757],[708,757],[886,98],[886,269],[888,754]].forEach(([x,y], i) => add('h'+i, 'home', 'Дом семьи '+LAST[i], x,y, i%3===0?62:54,38));
      add('farm','farm','Поля за воротами',94,630,80,48); add('mill','mill','Мельница у рощи',287,630,57,51);
      add('bakery','bakery','Пекарня «Золотой колос»',492,631,76,48); add('smith','smith','Кузница братьев Вольф',708,635,72,43);
      add('wood','wood','Лесной двор',98,452,65,40); add('fish','fish','Рыбацкий двор',914,632,70,39);
      add('tavern','tavern','Трактир «Три гуся»',287,451,82,54); add('church','church','Церковь Святой Марии',493,261,104,69);
      add('hall','hall','Городская ратуша',708,267,85,58); add('market','market','Длинный рынок',493,451,111,70);
      add('clinic','clinic','Лечебница Святого Луки',708,451,66,46); add('school','school','Приходская школа',708,98,66,44);
      add('dock','dock','Купеческая пристань',919,451,59,42);
    }
    createPerson(name, surname, sex, age, homeId, traits) {
      const b = this.building(homeId), id = this.nextId++;
      const p = { id, name: name+' '+surname, firstName: name, surname, sex, age, bornDay: Math.floor(this.random()*YEAR), homeId,
        traits: traits || [this.pick(TRAITS), this.pick(TRAITS)], hunger: 70+this.random()*25, energy: 75+this.random()*25, social: 55+this.random()*35, faith: 55+this.random()*35, mood: 72,
        health: age>65?75:100, coins: age<16?0:25+Math.floor(this.random()*75), reputation: 30+Math.floor(this.random()*40), skill: 1+this.random()*2,
        spouseId: null, parents: [], friendId: null, jobId: null, role: age<6?'Малыш':age<16?'Ученик':age>=65?'На покое':'Ищет ремесло', alive:true,
        x:b.x+this.random()*14-7, y:b.y+b.h/2+9, goal:homeId, path:[], action:'Дома', reason:'Набирается сил перед новым днём', work:0, earned:0, dailySocial:false, lastBirth:-100, sick:false };
      p.traits = [...new Set(p.traits)]; this.people.push(p); return p;
    }
    makePeople() {
      LAST.forEach((surname,i) => {
        const older = i === 10 || i === 11;
        const father = this.createPerson(FIRST.m[i],surname,'m',older?68+i%4:31+i%9,'h'+i);
        const mother = this.createPerson(FIRST.f[i],surname,'f',older?65+i%3:27+i%10,'h'+i);
        father.spouseId=mother.id; mother.spouseId=father.id;
        const a=this.createPerson(FIRST.m[(i+4)%12],surname,'m',older?23:11+i%9,'h'+i);
        const b=this.createPerson(FIRST.f[(i+6)%12],surname,'f',older?20:4+i%7,'h'+i);
        a.parents=b.parents=[father.id,mother.id];
      });
    }
    assignJobs() {
      const priority=['bakery','farm','mill','fish','clinic','church','tavern','smith','wood','school','market','dock','hall'];
      for(const p of this.alive) {
        if(p.age>=65 && p.id!==this.mayorId) {p.jobId=null;p.role='На покое';}
        if(p.age<16 || p.age>=65 || p.jobId) continue;
        const place=priority.find(id=>this.workers(id).length<TYPES[this.building(id).type].slots);
        if(place) {p.jobId=place;p.role=TYPES[this.building(place).type].job;} else {p.role='Подёнщик';p.jobId='dock';}
      }
    }
    workers(id) { return this.alive.filter(p=>p.jobId===id); }
    occupants(id) { return this.alive.filter(p=>p.goal===id && !p.path.length); }
    log(text,type='life',personId=null) { this.events.unshift({day:this.day,minute:Math.floor(this.minute),text,type,personId});this.events=this.events.slice(0,100); }
    entrance(b) { return {x:b.x,y:b.y+b.h/2+12}; }
    travel(p,id,action,reason) {
      p.action=action;p.reason=reason;
      if(p.goal===id) return;
      const b=this.building(id);if(!b)return;
      const dest=this.entrance(b), near=(v,a)=>a.reduce((n,c)=>Math.abs(c-v)<Math.abs(n-v)?c:n);
      const sy=near(p.y,ROADY), sx=near(p.x,ROADX), dy=near(dest.y,ROADY), dx=near(dest.x,ROADX);
      p.goal=id;
      p.path=[{x:p.x,y:sy},{x:sx,y:sy},{x:dx,y:sy},{x:dx,y:dy},{x:dest.x,y:dy},dest];
      p.path=p.path.filter((n,i,a)=>i===0 || n.x!==a[i-1].x || n.y!==a[i-1].y);
    }
    decide(p) {
      const h=this.hour, has=t=>p.traits.includes(t), home=p.homeId;
      if(p.sick && h>=8 && h<18 && this.workers('clinic').some(x=>x.id!==p.id)) return this.travel(p,'clinic','У лекаря','Нездоровится. Ищет помощи в лечебнице');
      if(h<6 || h>=22 || p.energy<13) return this.travel(p,home,'Спит','Пора отдохнуть и восстановить силы');
      if(p.hunger<34) return this.travel(p,h<8?home:'market','Ищет еду',this.food?'Проголодался и отправился за едой':'Городские запасы иссякли. Ищет хоть что-нибудь');
      if(p.age<6) return this.travel(p,home,'Дома','Играет дома под присмотром семьи');
      if(p.age<16 && h>=8 && h<14) return this.travel(p,'school','Учится','Уроки чтения и счёта в приходской школе');
      const workEnd=has('Ленивый')?15:17, workStart=has('Ленивый')?10:8;
      if(p.jobId && h>=workStart && h<workEnd) {
        const b=this.building(p.jobId);
        if(!b.damaged)return this.travel(p,p.jobId,'Работает',has('Трудолюбивый')?'Любит своё ремесло и работает с усердием':'Рабочий день. Нужно заработать на жизнь');
      }
      if(h<8) return this.travel(p,home,'Завтракает','Семья собирается перед началом дня');
      if(this.festivalDay===this.day && h>=17 && h<22) return this.travel(p,'market','На празднике','Музыка и угощение на Длинном рынке');
      if((has('Набожный') && p.faith<88 || p.faith<30) && h>=17 && h<20) return this.travel(p,'church','На службе','Ищет спокойствия в вечерней молитве');
      if((has('Общительный') || p.social<58) && h>=17 && h<21 && !has('Замкнутый'))return this.travel(p,p.age<16?'market':'tavern',p.age<16?'Гуляет':'В трактире','Хочет пообщаться и услышать городские новости');
      if(h>=18)return this.travel(p,home,'Дома','Проводит вечер с близкими');
      return this.travel(p,'market','На рынке',p.age>=65?'Гуляет по площади и встречает знакомых':'Свободное время среди торговых рядов');
    }
    move(p,dt) {
      let distance=dt*(p.age>65?6:9);
      while(p.path.length && distance>0) {const t=p.path[0],dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy);if(d<=distance){p.x=t.x;p.y=t.y;distance-=d;p.path.shift();}else{p.x+=dx/d*distance;p.y+=dy/d*distance;distance=0;}}
    }
    tick(dt) {
      for(const p of this.alive) {
        p.hunger=clamp(p.hunger-dt*.048);p.social=clamp(p.social-dt*.019);p.faith=clamp(p.faith-dt*.015);
        this.decide(p);this.move(p,dt);
        const settled=!p.path.length,b=this.building(p.goal);
        if(settled && p.action==='Спит')p.energy=clamp(p.energy+dt*.14);else p.energy=clamp(p.energy-dt*.026);
        if(settled && (b.type==='home'||b.type==='market') && p.hunger<67 && (p.coins>=1 || p.age<16 || this.tax<=5)) {
          const food=this.goods.bread>=1?'bread':this.goods.fish>=1?'fish':null;
          if(food){this.goods[food]-=1;p.hunger=clamp(p.hunger+57);if(p.age>=16 && p.coins>=1)p.coins-=1;}
        }
        if(settled && p.action==='Работает' && !b.damaged) {
          const diligence=p.traits.includes('Трудолюбивый')?1.35:1;
          const factor=diligence*(.65+p.energy/200)*(this.goods.tools>0?1.08:.8)*(p.sick?.4:1);
          p.work+=dt; p.skill=Math.min(10,p.skill+dt*.00015);
          const recipe=TYPES[b.type].recipe;
          if(recipe){
            const seasonal=b.type==='farm'?(this.season==='Зима'?.35:this.weather==='Дождь'?.8:1):1;
            b.progress+=dt*factor*seasonal;
            while(b.progress>=recipe.time){
              if(recipe.input && this.goods[recipe.input]<recipe.cost){b.progress=recipe.time;break;}
              if(recipe.input)this.goods[recipe.input]-=recipe.cost;
              this.goods[recipe.out]+=recipe.amount;b.output+=recipe.amount;b.today+=recipe.amount;this.produced+=recipe.amount;b.progress-=recipe.time;
            }
          }
        }
        if(settled && b.type==='clinic' && p.sick && this.workers('clinic').some(d=>d.id!==p.id && d.goal==='clinic' && !d.path.length)) {p.health=clamp(p.health+dt*.11);if(p.health>88){p.sick=false;this.log(p.name+' поправляется после болезни.','life',p.id);}}
        if(settled && b.type==='church'){p.faith=clamp(p.faith+dt*.12);p.social=clamp(p.social+dt*.025);}
        if(settled && (b.type==='tavern'||b.type==='market'))p.social=clamp(p.social+dt*.13);
        if(settled && b.type==='home')p.social=clamp(p.social+dt*.022);
        if(p.hunger<8)p.health=clamp(p.health-dt*.025);else if(!p.sick)p.health=clamp(p.health+dt*.01);
        const target=p.hunger*.27+p.energy*.23+p.social*.19+p.health*.2+p.faith*.11-this.tax*.45+(this.festivalDay===this.day?14:0);
        p.mood=clamp(p.mood+(target-p.mood)*.025);
        if(p.health<=0)this.die(p,'не пережил тяжёлые времена');
        if(settled && this.hour>=18 && !p.dailySocial && ['tavern','market','church'].includes(b.type))this.socialize(p);
      }
    }
    socialize(p) {
      p.dailySocial=true;
      const other=this.pick(this.occupants(p.goal).filter(q=>q.id!==p.id && Math.abs(q.age-p.age)<25));
      if(!other)return;
      if(p.traits.includes('Вспыльчивый') && this.random()<.22){p.reputation=clamp(p.reputation-3);p.mood=clamp(p.mood-9);other.mood=clamp(other.mood-6);this.log(p.name+' и '+other.name+' поссорились из-за пустяка.','conflict',p.id);}
      else if(this.random()<.18){p.friendId=other.id;other.friendId=p.id;p.reputation=clamp(p.reputation+1);this.log(p.name+' и '+other.name+' разговорились и стали ближе.','life',p.id);}
    }
    advance(minutes) {
      this.remainder+=minutes;
      while(this.remainder>=STEP){this.remainder-=STEP;this.tick(STEP);this.minute+=STEP;if(this.minute>=1440){this.minute-=1440;this.day++;this.newDay();}}
    }
    nextMorning() {this.advance(1440-this.minute+360);}
    die(p,cause) {if(!p.alive)return;p.alive=false;p.path=[];this.deaths++;this.log(p.name+', '+p.age+' лет, '+cause+'.','death',p.id);const spouse=this.person(p.spouseId);if(spouse?.alive){spouse.spouseId=null;spouse.mood=clamp(spouse.mood-25);}if(p.id===this.mayorId)this.election();}
    newDay() {
      this.weather=this.pick(['Ясно','Ясно','Облачно','Дождь']);
      for(const b of this.buildings){b.today=0;if(b.damaged && this.day-b.damageDay>=3 && this.treasury>=20){b.damaged=false;this.treasury-=20;b.repairedDay=this.day;this.log('Мастера своими силами восстановили здание «'+b.name+'». Из казны выделено 20 талеров.','economy');}}
      let taxes=0;
      for(const p of this.alive) {
        p.dailySocial=false;
        const pay=p.age>=16 && p.jobId?p.work/60*(p.id===this.mayorId?1.7:1.1):0;
        const tax=pay*this.tax/100;p.coins+=pay-tax;p.earned=pay-tax;taxes+=tax;p.work=0;
        if(p.coins<1 && p.age>=65){p.coins+=2;this.treasury=Math.max(0,this.treasury-2);}
        if(this.day%YEAR===p.bornDay){p.age++;if(p.age===16){p.role='Ищет ремесло';this.log(p.name+' исполнилось 16 лет. Начинается взрослая жизнь.','life',p.id);}}
        if(!p.sick && this.random()<.006){p.sick=true;p.health=Math.min(p.health,63);this.log(p.name+' заболел и нуждается в лекаре.','health',p.id);}
        if(p.sick)p.health=clamp(p.health-1.5);
        if(p.age>68 && this.random()<(p.age-68)*.0008)this.die(p,'скончался от старости');
      }
      this.treasury+=taxes;
      this.goods.tools=Math.max(0,this.goods.tools-this.alive.filter(p=>p.jobId).length*.025);
      if(this.day%3===0)this.exportSurplus();
      if(this.day%12===0)this.election();
      this.families();this.assignJobs();
      if(this.day%4===2 && this.random()<.65){const b=this.pick(this.buildings.filter(b=>TYPES[b.type].recipe && !b.damaged));if(b){b.damaged=true;b.damageDay=this.day;this.log('Пожар повредил здание «'+b.name+'». Мастера восстановят его за 3 дня; совет может помочь раньше.','fire');}}
      if(this.alive.length && this.food<this.alive.length*.8 && this.treasury>=60){this.treasury-=60;this.goods.bread+=100;this.log('Совет открыл экстренные поставки: 100 порций хлеба за 60 талеров.','food');}
      if(this.food<this.alive.length)this.log('На рынке мало еды. Горожане тревожатся о завтрашнем дне.','food');
      else if(this.day%3===1)this.log('В городе '+this.alive.length+' жителей. За день собрано '+Math.floor(taxes)+' талеров налогов.','economy');
      if(this.day%6===0)this.log('Наступает '+this.season.toLowerCase()+'. '+(this.season==='Зима'?'Поля дают меньше урожая.':'Город встречает новый сезон.'),'season');
    }
    exportSurplus(){let value=0;for(const [key,limit,price] of [['bread',220,.3],['fish',150,.4],['grain',240,.2],['flour',200,.2],['tools',50,1.5],['wood',220,.2]]){const n=Math.max(0,this.goods[key]-limit);this.goods[key]-=n;value+=n*price;}if(value>0){this.treasury+=value;this.log('Купеческий караван выкупил излишки. Город получил '+Math.floor(value)+' талеров.','economy');}}
    families(){
      const singles=this.alive.filter(p=>p.age>=18 && p.age<45 && !p.spouseId);
      if(singles.length>1 && this.random()<.4){const a=this.pick(singles),b=this.pick(singles.filter(p=>p.sex!==a.sex && p.surname!==a.surname && !p.parents.includes(a.id) && !a.parents.includes(p.id) && !p.parents.some(id=>a.parents.includes(id))));if(b){a.spouseId=b.id;b.spouseId=a.id;b.homeId=a.homeId;a.mood=clamp(a.mood+18);b.mood=clamp(b.mood+18);this.log(a.name+' и '+b.name+' сыграли свадьбу.','family',a.id);}}
      if(this.alive.length>=90 || this.food<this.alive.length)return;
      const mothers=this.alive.filter(p=>p.sex==='f' && p.age>=20 && p.age<43 && p.spouseId && this.person(p.spouseId)?.alive && this.day-p.lastBirth>=YEAR*2 && this.people.filter(c=>c.parents.includes(p.id)).length<4);
      if(mothers.length && this.random()<.24){const mother=this.pick(mothers),sex=this.pick(['m','f']),child=this.createPerson(this.pick(FIRST[sex]),mother.surname,sex,0,mother.homeId);child.parents=[mother.id,mother.spouseId];child.bornDay=this.day%YEAR;mother.lastBirth=this.day;this.births++;this.log('В семье '+mother.surname+' родился ребёнок — '+child.firstName+'.','family',child.id);}
    }
    election(){const candidates=this.alive.filter(p=>p.age>=25);if(!candidates.length){this.mayorId=null;return;}const ranked=candidates.map(p=>({p,score:p.reputation+(p.traits.includes('Амбициозный')?12:0)+(p.traits.includes('Общительный')?6:0)+this.random()*18})).sort((a,b)=>b.score-a.score);const previous=this.person(this.mayorId);if(previous?.alive){previous.jobId=null;previous.role='Ищет ремесло';}const p=ranked[0].p;this.mayorId=p.id;p.role='Бургомистр';p.jobId='hall';p.reputation=clamp(p.reputation+3);this.log('Городской совет избрал бургомистром '+p.name+'. Следующие выборы через 12 дней.','politics',p.id);this.assignJobs();}
    act(action,buildingId=null) {
      const prices={food:45,festival:65,repair:35};
      if(!(action in prices))return {ok:false,message:'Неизвестное решение'};
      if(action==='festival' && this.festivalDay===this.day)return {ok:false,message:'Сегодня праздник уже объявлен'};
      const damaged=this.buildings.filter(b=>b.damaged);
      if(action==='repair' && !damaged.length)return {ok:false,message:'Все здания в порядке'};
      if(this.treasury<prices[action])return {ok:false,message:'В казне не хватает талеров'};
      this.treasury-=prices[action];
      if(action==='food'){this.goods.bread+=75;this.log('Совет закупил 75 порций хлеба у соседей за 45 талеров.','economy');}
      if(action==='festival'){this.festivalDay=this.day;for(const p of this.alive){p.mood=clamp(p.mood+12);p.social=clamp(p.social+12);}this.log('Совет объявил городской праздник. После 17:00 все собираются на рынке.','festival');}
      if(action==='repair'){const b=damaged.find(b=>b.id===buildingId)||damaged[0];b.damaged=false;b.repairedDay=this.day;this.log('Горожане потушили огонь и восстановили здание «'+b.name+'».','economy');}
      return {ok:true,message:this.events[0].text};
    }
    setTax(v){const next=Math.round(clamp(Number(v)||0,0,30));if(next!==this.tax){this.tax=next;this.log('Совет установил налог на заработок: '+next+'%.','politics');}}
    toJSON(){return {version:1,state:{...this}};}
    static fromJSON(data){
      if(!data || data.version!==1 || !data.state)throw Error('Несовместимое сохранение');
      const s=data.state,finite=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
      if(!finite(s.day,0,10000000)||!finite(s.minute,0,1439.99)||!finite(s.seed,0,4294967295)||!finite(s.tax,0,30)||!finite(s.treasury,0,1e12)||!finite(s.remainder,0,4.99999)||!finite(s.nextId,1,1e8)||!Array.isArray(s.people)||s.people.length>10000||!Array.isArray(s.buildings)||s.buildings.length!==25||!Array.isArray(s.events))throw Error('Повреждённое сохранение');
      for(const key of Object.keys(GOODS))if(!finite(s.goods?.[key],0,1e12))throw Error('Некорректные запасы');
      const ids=new Set(s.buildings.map(b=>b.id));if(ids.size!==25)throw Error('Некорректные здания');
      for(const b of s.buildings)if(!TYPES[b.type]||!finite(b.x,0,1160)||!finite(b.y,0,820)||!finite(b.progress,0,1e9))throw Error('Некорректное здание');
      for(const p of s.people)if(typeof p.name!=='string'||!Array.isArray(p.traits)||!Array.isArray(p.parents)||!Array.isArray(p.path)||!ids.has(p.homeId)||!ids.has(p.goal)||p.jobId&&!ids.has(p.jobId)||!finite(p.age,0,10000)||!finite(p.x,0,1160)||!finite(p.y,0,820)||!['health','energy','hunger','social','faith','mood','coins','reputation','skill','work'].every(k=>finite(p[k],0,1e12)))throw Error('Некорректный житель');
      const sim=Object.create(Simulation.prototype);Object.assign(sim,s);return sim;
    }
  }
  const api={Simulation,TYPES,GOODS,ROADX,ROADY,YEAR,clamp};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Danzig=api;
})(typeof window!=='undefined'?window:globalThis);
