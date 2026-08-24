const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.6';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ALLIANCE_DURATION = 4;
const CARD_CATALOG = [
  { id:'ALLIANCE_OFFER', name:'دعوة التحالف', description:'أرسل عرض تحالف سري إلى لاعب واحد.', effect:'تحالف سري', targetRequired:true, price:5, exceptional:true },
  { id:'SECRET_MSG', name:'رسالة مشفرة', description:'أرسل نصًا خاصًا إلى لاعب واحد.', effect:'رسالة خاصة', targetRequired:true, price:3 },
  { id:'ATTACK', name:'ضربة في الظلام', description:'تخفض 3 سمعة من الهدف وتفتح قضية.', effect:'هجوم', targetRequired:true, price:4 },
  { id:'STEAL', name:'سرقة النفوذ', description:'تنقل نقطتين من سمعة الهدف إليك.', effect:'سرقة', targetRequired:true, price:4 },
  { id:'BOOST', name:'خطاب مؤثر', description:'تكسب نقطتي سمعة.', effect:'سمعة', targetRequired:false, price:3 },
  { id:'INTERROGATE', name:'سؤال القاضي', description:'تصلك معلومة سرية عن حركة الهدف.', effect:'تحقيق', targetRequired:true, price:4 },
  { id:'FORCE_REVEAL', name:'مرآة السجلات', description:'يكشف مخزون الهدف علنًا.', effect:'كشف', targetRequired:true, price:6 },
  { id:'SHIELD', name:'ستارة الحماية', description:'تحميك من أول خسارة سمعة في الجولة.', effect:'حماية', targetRequired:false, price:6, exceptional:true },
  { id:'ALLY_SHIELD', name:'درع الحليف', description:'يحمي حليفك من أول خسارة سمعة.', effect:'حماية التحالف', targetRequired:false, price:7, exceptional:true },
  { id:'DOUBLE_VOTE', name:'صوتان في الظل', description:'يضاعف وزن تصويتك في هذه الجولة.', effect:'تصويت', targetRequired:false, price:7, exceptional:true },
  { id:'EVIDENCE_FOG', name:'ضباب الدليل', description:'يخفض ثقة التقرير بهذه الجولة.', effect:'تضليل', targetRequired:false, price:5 },
  { id:'TRUTH_PIN', name:'دبوس الحقيقة', description:'يرفع ثقة الدليل قليلًا دون كشف اسم.', effect:'قرينة', targetRequired:false, price:7, exceptional:true },
  { id:'REPUTATION_DRAIN', name:'استنزاف الهيبة', description:'تخفض نقطة سمعة من الهدف دون قضية هجوم.', effect:'استنزاف', targetRequired:true, price:3 },
  { id:'REPUTATION_GIFT', name:'منحة مجهولة', description:'تمنح الهدف نقطتي سمعة.', effect:'منحة', targetRequired:true, price:3 },
  { id:'SWAP_REPUTATION', name:'مقايضة السمعة', description:'تبادل نقطة سمعة بينك وبين الهدف.', effect:'مقايضة', targetRequired:true, price:5 },
  { id:'WATCH', name:'عين المراقب', description:'تصلك إشارة عن كون الهدف لعب أثرًا هجوميًا.', effect:'مراقبة', targetRequired:true, price:5 },
  { id:'SILENCE', name:'ختم الصمت', description:'يظهر في سجل الهدف أنه تحت ضغط.', effect:'ضغط', targetRequired:true, price:4 },
  { id:'DECOY', name:'طُعم مضلل', description:'يزيد احتمال أن يكون الدليل مضللًا.', effect:'طُعم', targetRequired:false, price:5 },
  { id:'CANCEL_OFFER', name:'ختم الرفض', description:'يلغي عرض تحالف واردًا إليك.', effect:'إلغاء عرض', targetRequired:false, price:4 },
  { id:'MARKET_DISCOUNT', name:'قسيمة السوق', description:'تخفض سعر أول شراء تالٍ بنقطتين.', effect:'خصم', targetRequired:false, price:4 },
  { id:'CARD_DRAW', name:'سحب إضافي', description:'تمنحك بطاقة ثابتة إضافية من المجموعة.', effect:'سحب', targetRequired:false, price:6, exceptional:true },
  { id:'SAFE_PASS', name:'مرور آمن', description:'تحميك من أثر عشوائي واحد.', effect:'أمان', targetRequired:false, price:6, exceptional:true },
  { id:'PUBLIC_CLUE', name:'قصاصة علنية', description:'تضيف قرينة عامة غامضة بلا اسم.', effect:'قرينة عامة', targetRequired:false, price:5 },
  { id:'REVERSE_SUSPICION', name:'قلب الشبهة', description:'يحوّل جزءًا من خسارتك إلى شبهة عامة.', effect:'قلب الشبهة', targetRequired:false, price:6 },
  { id:'FINAL_WHISPER', name:'همسة الختام', description:'يضيف جملة غامضة إلى التقرير الختامي.', effect:'تقرير', targetRequired:false, price:8, exceptional:true }
];
const CATALOG = new Map(CARD_CATALOG.map(card => [card.id, card]));
const active = p => p && Number(p.reputation) > 0;
const id = value => String(value ?? '');
const clone = value => JSON.parse(JSON.stringify(value ?? null));
const unique = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const json = (res, status, body) => res.status(status).json(body);
function playersFrom(input) { return (Array.isArray(input) ? input : []).map((p, i) => ({ id:id(p?.id || `player-${i+1}`), name:String(p?.name || `لاعب ${i+1}`).slice(0,40), reputation:Math.max(0, Math.min(100, Number(p?.reputation)||0)), allyId:p?.allyId == null ? null : id(p.allyId), allyRoundsLeft:Math.max(0, Number(p?.allyRoundsLeft)||0), shield:Math.max(0, Number(p?.shield)||0), allyShield:Math.max(0, Number(p?.allyShield)||0), safePass:Math.max(0, Number(p?.safePass)||0), evidenceModifier:Number(p?.evidenceModifier)||0, votePower:Math.max(1, Number(p?.votePower)||1), marketDiscount:Math.max(0, Number(p?.marketDiscount)||0), inventory:Object.fromEntries(Object.entries(p?.inventory||{}).map(([k,v])=>[k,Math.max(0,Math.min(3,Number(v)||0))])) })) }
function mapPlayers(players) { return new Map(players.map(p => [p.id,p])); }
function messagesFrom(input) { const out={}; for(const [key,list] of Object.entries(input||{})) out[id(key)]=Array.isArray(list)?list.slice(-20).map(clone):[]; return out; }
function addMessage(messages, targetId, message) { const key=id(targetId); if(!key)return; if(!messages[key])messages[key]=[]; messages[key].push({id:unique('msg'),...message}); messages[key]=messages[key].slice(-20); }
function weighted(list) { const total=list.reduce((s,x)=>s+Math.max(0,Number(x.weight)||0),0); if(!total)return list[0]||null; let r=Math.random()*total; for(const x of list){r-=x.weight;if(r<=0)return x}return list[list.length-1]||null; }
function randomHand() { const others=CARD_CATALOG.filter(c=>c.id!=='ALLIANCE_OFFER'); const hand=[CARD_CATALOG[0]]; while(hand.length<3){const c=others[Math.floor(Math.random()*others.length)];if(!hand.some(x=>x.id===c.id))hand.push(c)}return hand; }
function privateOffer(out, targetId, offer) { const key=id(targetId); if(!out[key])out[key]=[]; out[key].push(offer); out[key]=out[key].slice(-3); }
async function aiText(prompt) { const key=process.env.OPENROUTER_KEY; if(!key)return null; const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),4500); try { const r=await fetch(OPENROUTER_URL,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','X-Title':'BoneMotion Secret Court'},body:JSON.stringify({model:MODEL,temperature:.7,max_tokens:300,messages:[{role:'system',content:'أنت كاتب محايد للعبة غموض عربية. أعد JSON فقط بلا Markdown.'},{role:'user',content:prompt}]})}); if(!r.ok)return null; const data=await r.json(); return data?.choices?.[0]?.message?.content||null; }catch{return null}finally{clearTimeout(timer)} }
async function makeAmbiguousReport(crimes, victims, modifier) { const fallback={clue:['شوهد ظل قرب الممر، لكن ذلك لا يثبت هوية أحد.','توجد قرينة ناقصة في السجل، وقد تقود إلى استنتاج مضلل.','اختفى جزء من الحقيقة بين الشهادات، ولا يكفي ذلك لإدانة أي لاعب.'][Math.floor(Math.random()*3)], report:victims.length?`يسجل التقرير أن ${victims.join(' و')} تعرضوا لأثر هجومي، لكنه لا يحدد الفاعل.`:'لم يسجل التقرير تعرض لاعب لهجوم مباشر.', confidence:Math.max(20,Math.min(70,45+modifier))}; if(!crimes.length)return fallback; const raw=await aiText(`اكتب JSON بالشكل {"clue":"","report":"","confidence":45}. وقائع مؤكدة: تعرض ${victims.join(' و')||'لاعبون غير محددين'} لهجوم أو سرقة. ممنوع ذكر اسم أي فاعل أو مشتبه به أو حليف أو تقديم برهان. clue يجب أن يكون شبهة قصيرة قابلة للتضليل. report يمكنه ذكر أسماء من تعرضوا للهجوم فقط، ويجب أن يوضح أنه تقديري.`); try { const parsed=raw?JSON.parse(raw.replace(/```json|```/g,'').trim()):null; if(parsed?.clue&&parsed?.report)return {clue:String(parsed.clue).slice(0,500),report:String(parsed.report).slice(0,500),confidence:Math.max(20,Math.min(70,Number(parsed.confidence)||fallback.confidence))}; }catch{} return fallback; }
function applyEvent(players) { const eligible=players.filter(active); if(!eligible.length)return null; const target=weighted(eligible.map(p=>({p,weight:Math.max(1,p.reputation)}))).p; if(target.safePass){target.safePass=0;return {type:'SAFE',targetId:target.id,description:'مرّ حدث عشوائي قرب لاعب، لكن بطاقة الأمان أبطلت أثره.'};} const roll=Math.random(); if(roll<.35){const amount=Math.max(1,Math.ceil(target.reputation*.12));if(!target.shield){target.reputation=Math.max(0,target.reputation-amount);return {type:'SUSPICION',targetId:target.id,description:`زادت الشكوك حول أحد أصحاب النفوذ وخسر ${amount} سمعة.`}}} if(roll<.55){target.reputation+=1;return {type:'GAIN',targetId:target.id,description:'وصلت شهادة مؤيدة مجهولة ومنحت لاعبًا نقطة سمعة.'}} return {type:'QUIET',targetId:null,description:'مرّ الحدث العشوائي بهدوء نسبي دون نتيجة حاسمة.'}; }
function allianceEffects(players, before, actions, messages) { const by=mapPlayers(players); for(const p of players){if(!p.allyId||p.id>p.allyId)continue;const a=by.get(p.allyId);if(!a||a.allyId!==p.id||!active(p)||!active(a))continue;const pd=p.reputation-before[p.id],ad=a.reputation-before[a.id];if(pd<0&&!p.shield&&!a.allyShield)a.reputation=Math.max(0,a.reputation+pd);if(ad<0&&!a.shield&&!p.allyShield)p.reputation=Math.max(0,p.reputation+ad);if(pd>0)a.reputation+=Math.floor(pd/2);if(ad>0)p.reputation+=Math.floor(ad/2);if(!actions.some(x=>[p.id,a.id].includes(id(x.playerId))&&['ATTACK','STEAL','REPUTATION_LOSS'].includes(x.cardId))){p.reputation++;a.reputation++;}addMessage(messages,p.id,{kind:'alliance',senderName:'أثر سري',text:'انعكس أثر التحالف عليك. لا يظهر هذا الأثر في التقرير العام.'});addMessage(messages,a.id,{kind:'alliance',senderName:'أثر سري',text:'انعكس أثر التحالف عليك. لا يظهر هذا الأثر في التقرير العام.'});} }
function ageAlliances(players) { const by=mapPlayers(players); for(const p of players){if(!p.allyId)continue;p.allyRoundsLeft--;const a=by.get(p.allyId);if(!a||p.allyRoundsLeft<=0||!active(p)||!active(a)){if(a){a.allyId=null;a.allyRoundsLeft=0}p.allyId=null;p.allyRoundsLeft=0}} }
async function handler(req,res){ if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'}); const body=req.body||{}; const action=body.action;
  if(action==='deal_hand')return json(res,200,{cards:randomHand()});
  if(action==='catalog')return json(res,200,{cards:CARD_CATALOG});
  if(action==='buy_card'){const card=CATALOG.get(id(body.cardId));const p=body.player||{};if(!card)return json(res,400,{error:'UNKNOWN_CARD'});const cost=Math.max(0,card.price-Math.max(0,Number(p.marketDiscount)||0));if(Number(p.reputation)<cost)return json(res,400,{error:'INSUFFICIENT_REPUTATION'});return json(res,200,{card,cost});}
  if(action==='resolve_round'){const players=playersFrom(body.players);const by=mapPlayers(players);const messages=messagesFrom(body.pendingMessages);const pendingOffers={};const actions=Array.isArray(body.actions)?body.actions:[];const hands=body.hands||{};const before=Object.fromEntries(players.map(p=>[p.id,p.reputation]));const crimes=[];const victims=[];const publicReveals=[];const used=new Set();let clueModifier=0;
    for(const item of actions){const actor=by.get(id(item.playerId));const card=CATALOG.get(id(item.cardId));const target=item.targetId==null?null:by.get(id(item.targetId));const hand=Array.isArray(hands[actor?.id])?hands[actor.id]:[];if(!actor||!active(actor)||!card||used.has(`${actor.id}:${card.id}`))continue;const inHand=hand.some(c=>id(c.id)===card.id)||(actor.inventory[card.id]||0)>0;if(!inHand)continue;if(card.targetRequired&&(!target||target.id===actor.id||!active(target)))continue;used.add(`${actor.id}:${card.id}`);if(actor.inventory[card.id])actor.inventory[card.id]--;
      if(card.id==='ALLIANCE_OFFER'){if(target&&!target.allyId&&!actor.allyId)privateOffer(pendingOffers,target.id,{id:unique('offer'),fromId:actor.id,fromName:actor.name});}
      else if(card.id==='SECRET_MSG')addMessage(messages,target.id,{kind:'private',senderId:actor.id,senderName:actor.name,text:String(item.text||'رسالة بلا نص').slice(0,300)});
      else if(card.id==='ATTACK'){if(!target.shield&&(!target.safePass)){target.reputation=Math.max(0,target.reputation-3);crimes.push({culpritId:actor.id,victimId:target.id,type:'ATTACK'});if(!victims.includes(target.name))victims.push(target.name);}}
      else if(card.id==='STEAL'){const amount=target.shield?0:Math.min(2,target.reputation);target.reputation-=amount;actor.reputation+=amount;crimes.push({culpritId:actor.id,victimId:target.id,type:'STEAL'});if(!victims.includes(target.name))victims.push(target.name);}
      else if(card.id==='BOOST')actor.reputation+=2;
      else if(card.id==='INTERROGATE')addMessage(messages,actor.id,{kind:'private',senderName:'نتيجة تحقيق',text:`توجد حركة غير عادية مرتبطة بالهدف ${target.name}، لكن لا يكفي ذلك لإثبات جريمة.`});
      else if(card.id==='FORCE_REVEAL')publicReveals.push({targetName:target.name,inventory:target.inventory});
      else if(card.id==='SHIELD')actor.shield=1;
      else if(card.id==='ALLY_SHIELD'&&actor.allyId){const a=by.get(actor.allyId);if(a)a.allyShield=1;}
      else if(card.id==='DOUBLE_VOTE')actor.votePower=2;
      else if(card.id==='EVIDENCE_FOG'||card.id==='DECOY')clueModifier-=15;
      else if(card.id==='TRUTH_PIN'||card.id==='PUBLIC_CLUE')clueModifier+=10;
      else if(card.id==='REPUTATION_DRAIN')target.reputation=Math.max(0,target.reputation-1);
      else if(card.id==='REPUTATION_GIFT')target.reputation+=2;
      else if(card.id==='SWAP_REPUTATION'){const n=Math.min(1,actor.reputation);actor.reputation=actor.reputation-n+Math.min(1,target.reputation);target.reputation=target.reputation-Math.min(1,target.reputation)+n;}
      else if(card.id==='WATCH')addMessage(messages,actor.id,{kind:'private',senderName:'عين المراقب',text:'راقبت الهدف، لكن الإشارة لا تثبت هوية الفاعل.'});
      else if(card.id==='SILENCE')addMessage(messages,target.id,{kind:'private',senderName:'ختم الصمت',text:'أصبحت تحت ضغط هذه الجولة.'});
      else if(card.id==='CANCEL_OFFER')pendingOffers[actor.id]=[];
      else if(card.id==='MARKET_DISCOUNT')actor.marketDiscount=2;
      else if(card.id==='CARD_DRAW')addMessage(messages,actor.id,{kind:'private',senderName:'سحب إضافي',text:'تستطيع طلب بطاقة شراء إضافية من السوق.'});
      else if(card.id==='SAFE_PASS')actor.safePass=1;
      else if(card.id==='REVERSE_SUSPICION')clueModifier-=10;
      else if(card.id==='FINAL_WHISPER')addMessage(messages,actor.id,{kind:'private',senderName:'همسة الختام',text:'قد يكون التقرير النهائي مضللًا جزئيًا.'});
    }
    const randomEvent=applyEvent(players);allianceEffects(players,before,actions,messages);ageAlliances(players);for(const p of players){p.shield=0;p.allyShield=0;p.safePass=Math.max(0,p.safePass);p.votePower=1;p.evidenceModifier=0;}
    const report=await makeAmbiguousReport(crimes,victims,clueModifier);const courtCase={title:crimes.length?'وقعت حادثة في المحكمة، لكن الفاعل غير محسوم.':'جلسة هادئة نسبيًا بلا جريمة مؤكدة.',trueCulpritId:crimes.length?crimes[Math.floor(Math.random()*crimes.length)].culpritId:null,clue:report.clue,confidence:report.confidence};
    return json(res,200,{players,pendingMessages:messages,pendingOffers,randomEvent,publicReveals,courtCase,report,ai:{enabled:Boolean(process.env.OPENROUTER_KEY),used:Boolean(process.env.OPENROUTER_KEY&&crimes.length)} });
  }
  if(action==='resolve_vote'){const players=playersFrom(body.players);const by=mapPlayers(players);const culpritId=body.trueCulpritId==null?null:id(body.trueCulpritId);const votes=Array.isArray(body.votes)?body.votes:[];const tally={};for(const vote of votes){const voter=by.get(id(vote.voterId));if(!active(voter))continue;const accused=vote.accusedId==null?'NONE':id(vote.accusedId);tally[accused]=(tally[accused]||0)+(voter.votePower||1);}const winner=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0]?.[0]||'NONE';let verdictMsg;if(winner===culpritId){const p=by.get(culpritId);if(p)p.reputation=Math.max(0,p.reputation-4);verdictMsg='أصاب التصويت الجاني الحقيقي، لكن الدليل السابق لم يكن برهانًا.'}else{const p=by.get(winner);if(p)p.reputation+=2;verdictMsg=winner==='NONE'&&culpritId===null?'كان قرار لا أحد صحيحًا.':'لم يحسم التصويت الحقيقة؛ حصل المتهم على تعويض.'}return json(res,200,{players,verdictMsg,finalEvidence:{confidence:culpritId?55:75,conclusion:'النتيجة تقديرية وقد تكون مضللة، ولا تكشف أي تحالف سري.'}})}
  return json(res,400,{error:'UNKNOWN_ACTION'});
}
export default async function api(req,res){try{return await handler(req,res)}catch(error){console.error(error);return json(res,500,{error:'SERVER_ERROR',message:'حدث خطأ في الخادم، والحالة المحلية محفوظة.'})}}
