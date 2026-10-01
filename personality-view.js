(function(root){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(s,p){const c=p.character;if(!c)return'';const P=root.DanzigPersonality;
    const strongest=Object.entries(c.values).sort((a,b)=>b[1]-a[1])[0],feeling=Object.entries(c.state).filter(([k,n])=>k!=='confidence'&&n>=8).sort((a,b)=>b[1]-a[1]);
    return `<section class="mind-section personality-portrait"><div class="section-label">ЛИЧНЫЙ ПОРТРЕТ${c.nickname?` <span>«${esc(c.nickname)}»</span>`:''}</div><p>${esc(P.labels[strongest[0]])} ${strongest[1]>.65?'особенно важна':'выражена сильнее других ценностей'}. ${feeling.length?'Сейчас переживает: '+feeling.map(([k])=>P.feelings[k].toLowerCase()).join(', ')+'.':'Сейчас нет сильных переживаний.'}</p><div class="mind-traits">${Object.entries(P.labels).map(([k,label])=>`<div><span>${label}</span><meter min="0" max="100" value="${Math.round(c.values[k]*100)}" aria-label="${label}"></meter><b>${Math.round(c.values[k]*100)}</b></div>`).join('')}</div><details data-disclosure="biography"><summary>Переживания и события жизни</summary><dl class="mind-facts">${Object.entries(P.feelings).map(([k,label])=>`<dt>${label}</dt><dd>${Math.round(c.state[k])} / 100</dd>`).join('')}</dl>${c.events.slice(0,8).map(e=>`<div class="memory-item"><span>${esc(e.text)}</span><small>День ${Math.floor(e.at/1440)+1}</small></div>`).join('')||'<p class="muted">Значимые личные события ещё не произошли.</p>'}<small class="muted">Ценности устойчивы; переживания ослабевают со временем. Прозвища появляются за повторные поступки.</small></details></section>`;
  }
  root.DanzigPersonalityView={render};
})(typeof window!=='undefined'?window:globalThis);
