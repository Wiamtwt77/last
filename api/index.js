
const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.6';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const ALLIANCE_DURATION = 4;
const EVENT_WEIGHTS = [
  { type: 'SUSPICION', weight: 35 },
  { type: 'CARD_LOSS', weight: 20 },
  { type: 'REPUTATION_GAIN', weight: 20 },
  { type: 'QUIET', weight: 25 }
];
const EFFECTS = ['REPUTATION_LOSS', 'STEAL', 'REPUTATION_GAIN', 'INVESTIGATE', 'MESSAGE', 'SHIELD'];

const json = (res, code, value) => res.status(code).json(value);
const active = p => p && Number(p.reputation) > 0;
const copy = value => JSON.parse(JSON.stringify(value ?? null));
const idOf = value => String(value ?? '');
const uniqueId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function normalizePlayers(input) {
  return (Array.isArray(input) ? input : []).map((raw, index) => ({
    id: idOf(raw?.id || `player-${index + 1}`),
    name: String(raw?.name || `لاعب ${index + 1}`).slice(0, 40),
    reputation: Math.max(0, Math.min(100, Number(raw?.reputation) || 0)),
    allyId: raw?.allyId == null ? null : idOf(raw.allyId),
    allyRoundsLeft: Math.max(0, Number(raw?.allyRoundsLeft) || 0),
    shieldRounds: Math.max(0, Number(raw?.shieldRounds) || 0)
  }));
}
function playerMap(players) { return new Map(players.map(p => [p.id, p])); }
function cloneMessages(input) {
  const result = {};
  for (const [key, list] of Object.entries(input || {})) result[idOf(key)] = Array.isArray(list) ? list.slice(-20).map(copy) : [];
  return result;
}
function addMessage(messages, targetId, message) {
  const key = idOf(targetId);
  if (!key) return;
  if (!messages[key]) messages[key] = [];
  messages[key].push({ id: uniqueId('msg'), ...message });
  messages[key] = messages[key].slice(-20);
}
function weightedPick(list, weightKey = 'weight') {
  const total = list.reduce((sum, item) => sum + Math.max(0, Number(item[weightKey]) || 0), 0);
  if (!total) return list[0] || null;
  let roll = Math.random() * total;
  for (const item of list) { roll -= Math.max(0, Number(item[weightKey]) || 0); if (roll <= 0) return item; }
  return list[list.length - 1] || null;
}
function weightedPlayer(players) {
  const eligible = players.filter(active);
  if (!eligible.length) return null;
  return weightedPick(eligible.map(p => ({ p, weight: Math.max(1, p.reputation) })))?.p || eligible[0];
}
function fallbackCard(round, index) {
  const effectType = EFFECTS[(round + index + Math.floor(Math.random() * EFFECTS.length)) % EFFECTS.length];
  const labels = {
    REPUTATION_LOSS: ['ختم الشك', 'مرآة الاتهام', 'ظل القضية'], STEAL: ['حبر النفوذ', 'مفتاح السجلات', 'صفقة خفية'],
    REPUTATION_GAIN: ['شهادة موثوقة', 'ختم البراءة', 'صوت الجمهور'], INVESTIGATE: ['عين القاضي', 'عدسة التحقيق', 'سؤال حاسم'],
    MESSAGE: ['همسة مشفرة', 'بريد الظلال', 'رسالة بلا أثر'], SHIELD: ['درع الشاهد', 'ستارة الحماية', 'حصانة مؤقتة']
  };
  return { id: uniqueId('ai-card'), name: labels[effectType][index % 3], description: `أثر متجدد: ${effectType === 'REPUTATION_LOSS' ? 'يخفض سمعة الهدف.' : effectType === 'STEAL' ? 'ينقل نفوذًا من الهدف.' : effectType === 'REPUTATION_GAIN' ? 'يرفع سمعتك.' : effectType === 'INVESTIGATE' ? 'يكشف معلومة سرية.' : effectType === 'MESSAGE' ? 'يرسل نصًا خاصًا.' : 'يحميك من خسارة واحدة.'}`, effectType, power: effectType === 'STEAL' ? 2 : 2, targetRequired: !['REPUTATION_GAIN', 'SHIELD'].includes(effectType), cooldown: 1, rarity: 'متجددة' };
}
function sanitizeCard(raw, round, index) {
  const effectType = EFFECTS.includes(raw?.effectType) ? raw.effectType : null;
  if (!effectType || typeof raw?.name !== 'string') return fallbackCard(round, index);
  return { id: uniqueId('ai-card'), name: String(raw.name).slice(0, 48), description: String(raw.description || 'أثر مولد بالذكاء الاصطناعي.').slice(0, 220), effectType, power: Math.max(1, Math.min(3, Number(raw.power) || 1)), targetRequired: Boolean(raw.targetRequired ?? !['REPUTATION_GAIN', 'SHIELD'].includes(effectType)), cooldown: Math.max(1, Math.min(3, Number(raw.cooldown) || 1)), rarity: String(raw.rarity || 'نادرة').slice(0, 20) };
}
async function openRouter(prompt, maxTokens = 500) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(OPENROUTER, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'BoneMotion Secret Court' }, body: JSON.stringify({ model: MODEL, temperature: 0.9, max_tokens: maxTokens, messages: [{ role: 'system', content: 'أنت مصمم لعبة عربية. أعد JSON صالحًا فقط بلا Markdown.' }, { role: 'user', content: prompt }] }) });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function generateCards(round, context) {
  const prompt = `ولّد 3 بطاقات مختلفة تمامًا للجولة ${round}. يجب أن تكون مصممة للعبة تمرير هاتف اسمها المحكمة السرية. أعد JSON فقط بالشكل {"cards":[{"name":"","description":"","effectType":"REPUTATION_LOSS|STEAL|REPUTATION_GAIN|INVESTIGATE|MESSAGE|SHIELD","power":1,"targetRequired":true,"cooldown":1,"rarity":""}]}. لا تستخدم أسماء البطاقات السابقة: ${JSON.stringify(context || [])}. اجعل واحدة على الأقل قابلة لإرسال رسالة أو تحقيق، ولا تضف تأثيرات خارج القائمة.`;
  const raw = await openRouter(prompt);
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : null; } catch { parsed = null; }
  const source = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const cards = [0, 1, 2].map(i => sanitizeCard(source[i], round, i));
  cards[0] = { ...cards[0], id: uniqueId('alliance-card'), name: source[0]?.name || 'دعوة التحالف', description: source[0]?.description || 'إرسال عرض تحالف سري إلى لاعب واحد.', effectType: 'ALLIANCE_OFFER', targetRequired: true, power: 0, cooldown: 1, rarity: 'مضمونة' };
  return { cards, aiUsed: Boolean(raw) };
}
function chooseEvent(players) {
  const target = weightedPlayer(players);
  if (!target) return null;
  const event = weightedPick(EVENT_WEIGHTS);
  if (event.type === 'SUSPICION') { const amount = Math.max(1, Math.ceil(target.reputation * 0.15)); target.reputation = Math.max(0, target.reputation - amount); return { type: event.type, targetId: target.id, description: `زادت الشكوك حول ${target.name} وخسر ${amount} من السمعة.` }; }
  if (event.type === 'CARD_LOSS') return { type: event.type, targetId: target.id, description: `تعرض ${target.name} لموقف محرج، لكن مخزون البطاقات تديره يده الخاصة في هذه الجولة.` };
  if (event.type === 'REPUTATION_GAIN') { target.reputation += 1; return { type: event.type, targetId: target.id, description: `شهد أحد الحاضرين لصالح ${target.name} فكسب نقطة سمعة.` }; }
  return { type: 'QUIET', targetId: null, description: 'مرت الجولة بهدوء نسبي دون حادثة عامة.' };
}
function applyAllianceEffects(players, before, actions, messages) {
  const byId = playerMap(players);
  for (const p of players) {
    if (!p.allyId || p.id > p.allyId) continue;
    const ally = byId.get(p.allyId);
    if (!ally || ally.allyId !== p.id || !active(p) || !active(ally)) continue;
    const pDelta = p.reputation - before[p.id]; const aDelta = ally.reputation - before[ally.id];
    if (pDelta < 0 && !p.shieldRounds) ally.reputation = Math.max(0, ally.reputation + pDelta);
    if (aDelta < 0 && !ally.shieldRounds) p.reputation = Math.max(0, p.reputation + aDelta);
    if (pDelta > 0) ally.reputation += Math.floor(pDelta / 2);
    if (aDelta > 0) p.reputation += Math.floor(aDelta / 2);
    const usedCrime = actions.some(a => [p.id, ally.id].includes(idOf(a.playerId)) && ['REPUTATION_LOSS', 'STEAL'].includes(a.generatedCard?.effectType));
    if (!usedCrime) { p.reputation += 1; ally.reputation += 1; }
    addMessage(messages, ally.id, { kind: 'alliance-effect', senderName: 'أثر التحالف', text: `انعكس تغير سمعة حليفك ${p.name} عليك وفق قواعد التحالف.` });
    addMessage(messages, p.id, { kind: 'alliance-effect', senderName: 'أثر التحالف', text: `انعكس تغير سمعة حليفك ${ally.name} عليك وفق قواعد التحالف.` });
  }
}
function ageAlliances(players) {
  const byId = playerMap(players);
  for (const p of players) { if (!p.allyId) continue; p.allyRoundsLeft -= 1; const ally = byId.get(p.allyId); if (!ally || p.allyRoundsLeft <= 0 || !active(p) || !active(ally)) { if (ally) { ally.allyId = null; ally.allyRoundsLeft = 0; } p.allyId = null; p.allyRoundsLeft = 0; } }
}
async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body || {}; const action = body.action;
  if (action === 'generate_cards') { const result = await generateCards(Number(body.round) || 1, body.existingCards); return json(res, 200, result); }
  if (action === 'resolve_round') {
    const players = normalizePlayers(body.players); const byId = playerMap(players); const messages = cloneMessages(body.pendingMessages); const actions = Array.isArray(body.actions) ? body.actions : []; const before = Object.fromEntries(players.map(p => [p.id, p.reputation])); const crimes = []; const publicReveals = [];
    for (const actionItem of actions) {
      const actor = byId.get(idOf(actionItem.playerId)); const card = actionItem.generatedCard; const target = actionItem.targetId == null ? null : byId.get(idOf(actionItem.targetId));
      if (!active(actor) || !card || !card.id || !card.effectType || !actionItem.cardId || idOf(actionItem.cardId) !== idOf(card.id)) continue;
      if (card.targetRequired && (!target || target.id === actor.id || !active(target))) continue;
      if (card.effectType === 'ALLIANCE_OFFER') { if (!target || target.allyId || actor.allyId) continue; const key = target.id; const offers = messages[`offers:${key}`] || []; offers.push({ id: uniqueId('offer'), fromId: actor.id, fromName: actor.name }); messages[`offers:${key}`] = offers.slice(-5); }
      else if (card.effectType === 'MESSAGE') addMessage(messages, target.id, { kind: 'private', senderId: actor.id, senderName: actor.name, text: String(actionItem.text || card.description).slice(0, 300) });
      else if (card.effectType === 'REPUTATION_LOSS') { const amount = Math.min(card.power, target.reputation); if (!target.shieldRounds) target.reputation -= amount; crimes.push({ culpritId: actor.id, targetId: target.id, targetName: target.name, type: card.effectType }); }
      else if (card.effectType === 'STEAL') { const amount = target.shieldRounds ? 0 : Math.min(card.power, target.reputation); target.reputation -= amount; actor.reputation += amount; crimes.push({ culpritId: actor.id, targetId: target.id, targetName: target.name, type: card.effectType }); }
      else if (card.effectType === 'REPUTATION_GAIN') actor.reputation += card.power;
      else if (card.effectType === 'INVESTIGATE') addMessage(messages, actor.id, { kind: 'private', senderName: 'نتيجة التحقيق', text: `سمعة ${target.name} الحالية: ${target.reputation}.` });
      else if (card.effectType === 'SHIELD') actor.shieldRounds = 1;
    }
    const randomEvent = chooseEvent(players); applyAllianceEffects(players, before, actions, messages); ageAlliances(players); players.forEach(p => { p.shieldRounds = Math.max(0, p.shieldRounds - 1); });
    let courtCase = { title: 'جلسة هادئة: لا توجد جريمة مؤكدة.', trueCulpritId: null, clue: 'لا توجد جريمة مؤكدة في سجل هذه الجولة.', confidence: 80 };
    if (crimes.length) { const crime = crimes[Math.floor(Math.random() * crimes.length)]; const suspect = byId.get(crime.culpritId); courtCase = { title: `قضية: ${crime.targetName} تعرض لأثر ${crime.type}.`, trueCulpritId: crime.culpritId, clue: `تشير القرائن إلى ${suspect?.name || 'مشتبه به غير معروف'}، وقد تكون مضللة.`, confidence: 60 }; const raw = await openRouter(`حلّل هذه القضية بالعربية وأعد JSON فقط بالشكل {"clue":"","confidence":60}. القضية: ${courtCase.title}. المشتبه الحقيقي المحتمل: ${suspect?.name}. لا تضف أسماء جديدة.` , 250); try { const ai = raw ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : null; if (ai?.clue) { courtCase.clue = String(ai.clue).slice(0, 500); courtCase.confidence = Math.max(1, Math.min(99, Number(ai.confidence) || 60)); } } catch {} }
    const pendingOffers = {}; for (const [key, value] of Object.entries(messages)) if (key.startsWith('offers:')) { pendingOffers[key.slice(7)] = value; delete messages[key]; }
    return json(res, 200, { players, pendingMessages: messages, pendingOffers, randomEvent, publicReveals, courtCase, ai: { enabled: Boolean(process.env.OPENROUTER_KEY), used: Boolean(process.env.OPENROUTER_KEY && crimes.length) } });
  }
  if (action === 'resolve_vote') {
    const players = normalizePlayers(body.players); const byId = playerMap(players); const culpritId = body.trueCulpritId == null ? null : idOf(body.trueCulpritId); const votes = Array.isArray(body.votes) ? body.votes : []; const tally = {};
    for (const vote of votes) { const voter = byId.get(idOf(vote.voterId)); if (!active(voter)) continue; const accusedId = vote.accusedId == null ? 'NONE' : idOf(vote.accusedId); tally[accusedId] = (tally[accusedId] || 0) + 1; }
    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NONE'; let verdictMsg;
    if (winner === culpritId) { const culprit = byId.get(culpritId); if (culprit) culprit.reputation = Math.max(0, culprit.reputation - 4); verdictMsg = 'الحكم أصاب الجاني الحقيقي، وطبقت المحكمة العقوبة.'; }
    else { const wrong = byId.get(winner); if (wrong) wrong.reputation += 2; verdictMsg = winner === 'NONE' && culpritId === null ? 'قرار صحيح: لم تقع جريمة.' : 'الحكم لم يصب الجاني الحقيقي؛ حصل المتهم على تعويض.'; }
    return json(res, 200, { players, verdictMsg, finalEvidence: { confidence: culpritId ? 65 : 80, conclusion: culpritId ? `الجاني المسجل في هذه الجولة هو ${byId.get(culpritId)?.name || 'غير معروف'}.` : 'لا توجد جريمة مسجلة.', note: 'هذه النسبة تقديرية وليست يقينًا مطلقًا.' }});
  }
  return json(res, 400, { error: 'UNKNOWN_ACTION' });
}
export default async function api(req, res) { try { return await handler(req, res); } catch (error) { console.error(error); return json(res, 500, { error: 'SERVER_ERROR', message: 'حدث خطأ في الخادم، والحالة المحلية لم تُحذف.' }); } }
