const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.6';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const ALLIANCE_DURATION = 4;

// القائمة الثابتة للبطاقات (25 نوعاً محدداً تشمل بطاقات عادية ونادرة واستثنائية)
const CARD_DATABASE = [
  { baseId: 'c01', name: 'دعوة التحالف', description: 'إرسال عرض تحالف سري إلى لاعب واحد.', effectType: 'ALLIANCE_OFFER', power: 0, targetRequired: true, cooldown: 1, rarity: 'مضمونة', cost: 0 },
  { baseId: 'c02', name: 'ختم الشك', description: 'يخفض سمعة الهدف بمقدار 1.', effectType: 'REPUTATION_LOSS', power: 1, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c03', name: 'مرآة الاتهام', description: 'يخفض سمعة الهدف بمقدار 2.', effectType: 'REPUTATION_LOSS', power: 2, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c04', name: 'ظل القضية', description: 'يخفض سمعة الهدف بمقدار 2.', effectType: 'REPUTATION_LOSS', power: 2, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c05', name: 'طعنة الظلام', description: 'تخفيض مؤثر لسمعة الهدف بمقدار 3.', effectType: 'REPUTATION_LOSS', power: 3, targetRequired: true, cooldown: 2, rarity: 'نادرة', cost: 0 },
  { baseId: 'c06', name: 'حبر النفوذ', description: 'ينقل نقطة سمعة واحدة من الهدف إليك.', effectType: 'STEAL', power: 1, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c07', name: 'مفتاح السجلات', description: 'ينقل نقطتي سمعة من الهدف إليك.', effectType: 'STEAL', power: 2, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c08', name: 'صفقة خفية', description: 'ينقل نقطتي سمعة من الهدف إليك.', effectType: 'STEAL', power: 2, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c09', name: 'سلب الهيبة', description: 'ينقل 3 نقاط سمعة من الهدف إليك.', effectType: 'STEAL', power: 3, targetRequired: true, cooldown: 2, rarity: 'نادرة', cost: 0 },
  { baseId: 'c10', name: 'شهادة موثوقة', description: 'ترفع سمعتك بمقدار 1.', effectType: 'REPUTATION_GAIN', power: 1, targetRequired: false, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c11', name: 'ختم البراءة', description: 'ترفع سمعتك بمقدار 2.', effectType: 'REPUTATION_GAIN', power: 2, targetRequired: false, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c12', name: 'صوت الجمهور', description: 'ترفع سمعتك بمقدار 2.', effectType: 'REPUTATION_GAIN', power: 2, targetRequired: false, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c13', name: 'خطابة البلاغة', description: 'ترفع سمعتك بمقدار 3 نقاط.', effectType: 'REPUTATION_GAIN', power: 3, targetRequired: false, cooldown: 2, rarity: 'نادرة', cost: 0 },
  { baseId: 'c14', name: 'عين القاضي', description: 'تكشف سمعة الهدف الحالية بشكل سري.', effectType: 'INVESTIGATE', power: 1, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c15', name: 'عدسة التحقيق', description: 'تكشف سمعة الهدف الحالية بشكل سري.', effectType: 'INVESTIGATE', power: 1, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c16', name: 'كشف المستور', description: 'تحقيق سري يخبرك بوضع الهدف.', effectType: 'INVESTIGATE', power: 1, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c17', name: 'همسة مشفرة', description: 'ترسل رسالة سرية خاصة للهدف.', effectType: 'MESSAGE', power: 0, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c18', name: 'بريد الظلال', description: 'ترسل رسالة سرية خاصة للهدف.', effectType: 'MESSAGE', power: 0, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c19', name: 'رسالة بلا أثر', description: 'ترسل رسالة سرية غامضة للهدف.', effectType: 'MESSAGE', power: 0, targetRequired: true, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c20', name: 'درع الشاهد', description: 'يحميك من خسارة السمعة لمرة واحدة.', effectType: 'SHIELD', power: 1, targetRequired: false, cooldown: 1, rarity: 'عادية', cost: 0 },
  { baseId: 'c21', name: 'ستارة الحماية', description: 'يوفر حصانة مؤقتة في الجولة.', effectType: 'SHIELD', power: 1, targetRequired: false, cooldown: 1, rarity: 'عادية', cost: 0 },
  // بطاقات استثنائية (تتطلب شراء عبر المتجر)
  { baseId: 'c22', name: '★ حصانة العرش المطلقة', description: 'بطاقة استثنائية: حماية كاملة ورفع السمعة بمقدار 2.', effectType: 'EXCEPTIONAL_SHIELD', power: 2, targetRequired: false, cooldown: 2, rarity: 'استثنائية', cost: 1 },
  { baseId: 'c23', name: '★ صدمة الاتهام الكبير', description: 'بطاقة استثنائية: خفض سمعة الهدف بمقدار 4 نقاط.', effectType: 'EXCEPTIONAL_ATTACK', power: 4, targetRequired: true, cooldown: 2, rarity: 'استثنائية', cost: 1 },
  { baseId: 'c24', name: '★ الإنقاذ الملكي', description: 'بطاقة استثنائية: تمنحك 4 نقاط سمعة فوراً.', effectType: 'EXCEPTIONAL_GAIN', power: 4, targetRequired: false, cooldown: 2, rarity: 'استثنائية', cost: 1 },
  { baseId: 'c25', name: '★ الاستحواذ الأعظم', description: 'بطاقة استثنائية: تسلب 3 نقاط سمعة وتحولها إليك.', effectType: 'EXCEPTIONAL_STEAL', power: 3, targetRequired: true, cooldown: 2, rarity: 'استثنائية', cost: 1 }
];

const SHOP_CARDS = CARD_DATABASE.filter(c => c.rarity === 'استثنائية');

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

function getStaticHand() {
  const allianceCard = CARD_DATABASE[0];
  const pool = CARD_DATABASE.slice(1).filter(c => c.rarity !== 'استثنائية');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = [allianceCard, shuffled[0], shuffled[1]];
  return picked.map(c => ({ ...c, id: uniqueId('card') }));
}

async function openRouter(prompt, maxTokens = 300) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(OPENROUTER, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Secret Court' },
      body: JSON.stringify({
        model: MODEL, temperature: 0.9, max_tokens: maxTokens,
        messages: [
          { role: 'system', content: 'أنت صانع أدلة للعبة غموض عربية. أعد JSON صالحاً فقط. الأدلة يجب أن تكون شبهة عامة، ظنون، أو ظروف غامضة، بدون ذكر أسماء أي لاعب إطلاقاً وقد تكون مضللة.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; } finally { clearTimeout(timer); }
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
    const usedCrime = actions.some(a => [p.id, ally.id].includes(idOf(a.playerId)) && ['REPUTATION_LOSS', 'STEAL', 'EXCEPTIONAL_ATTACK', 'EXCEPTIONAL_STEAL'].includes(a.generatedCard?.effectType));
    if (!usedCrime) { p.reputation += 1; ally.reputation += 1; }
    addMessage(messages, ally.id, { kind: 'alliance-effect', senderName: 'أثر التحالف السري', text: `انعكس تغير سمعة حليفك عليك وفق قواعد التحالف.` });
    addMessage(messages, p.id, { kind: 'alliance-effect', senderName: 'أثر التحالف السري', text: `انعكس تغير سمعة حليفك عليك وفق قواعد التحالف.` });
  }
}

function ageAlliances(players) {
  const byId = playerMap(players);
  for (const p of players) {
    if (!p.allyId) continue;
    p.allyRoundsLeft -= 1;
    const ally = byId.get(p.allyId);
    if (!ally || p.allyRoundsLeft <= 0 || !active(p) || !active(ally)) {
      if (ally) { ally.allyId = null; ally.allyRoundsLeft = 0; }
      p.allyId = null; p.allyRoundsLeft = 0;
    }
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body || {}; const action = body.action;

  if (action === 'generate_cards') {
    const cards = getStaticHand();
    return json(res, 200, { cards, shopCards: SHOP_CARDS, aiUsed: false });
  }

  if (action === 'buy_card') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const buyer = byId.get(idOf(body.playerId));
    const cardBaseId = idOf(body.cardBaseId);
    const template = CARD_DATABASE.find(c => c.baseId === cardBaseId);

    if (!buyer || buyer.reputation <= 1 || !template) {
      return json(res, 400, { error: 'CANNOT_BUY', message: 'سمعتك لا تكفي للشراء أو البطاقة غير متوفرة.' });
    }

    buyer.reputation -= (template.cost || 1);
    const boughtCard = { ...template, id: uniqueId('bought-card') };
    return json(res, 200, { players, boughtCard });
  }

  if (action === 'resolve_round') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const messages = cloneMessages(body.pendingMessages);
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const before = Object.fromEntries(players.map(p => [p.id, p.reputation]));
    const crimes = [];
    const attackedIds = new Set();

    for (const actionItem of actions) {
      const actor = byId.get(idOf(actionItem.playerId));
      const card = actionItem.generatedCard;
      const target = actionItem.targetId == null ? null : byId.get(idOf(actionItem.targetId));

      if (!active(actor) || !card || !card.id || !card.effectType) continue;
      if (card.targetRequired && (!target || target.id === actor.id || !active(target))) continue;

      if (card.effectType === 'ALLIANCE_OFFER') {
        if (!target || target.allyId || actor.allyId) continue;
        const key = target.id;
        const offers = messages[`offers:${key}`] || [];
        offers.push({ id: uniqueId('offer'), fromId: actor.id, fromName: actor.name });
        messages[`offers:${key}`] = offers.slice(-5);
      }
      else if (card.effectType === 'MESSAGE') {
        addMessage(messages, target.id, { kind: 'private', senderId: actor.id, senderName: actor.name, text: String(actionItem.text || card.description).slice(0, 300) });
      }
      else if (['REPUTATION_LOSS', 'EXCEPTIONAL_ATTACK'].includes(card.effectType)) {
        const amount = Math.min(card.power, target.reputation);
        if (!target.shieldRounds) target.reputation -= amount;
        crimes.push({ culpritId: actor.id, targetId: target.id, type: card.effectType });
        attackedIds.add(target.id);
      }
      else if (['STEAL', 'EXCEPTIONAL_STEAL'].includes(card.effectType)) {
        const amount = target.shieldRounds ? 0 : Math.min(card.power, target.reputation);
        target.reputation -= amount;
        actor.reputation += amount;
        crimes.push({ culpritId: actor.id, targetId: target.id, type: card.effectType });
        attackedIds.add(target.id);
      }
      else if (['REPUTATION_GAIN', 'EXCEPTIONAL_GAIN'].includes(card.effectType)) {
        actor.reputation += card.power;
      }
      else if (card.effectType === 'INVESTIGATE') {
        addMessage(messages, actor.id, { kind: 'private', senderName: 'نتيجة التحقيق', text: `معلومات سرية: سمعة الهدف الحالية هي ${target.reputation}.` });
      }
      else if (card.effectType === 'SHIELD') {
        actor.shieldRounds = 1;
      }
      else if (card.effectType === 'EXCEPTIONAL_SHIELD') {
        actor.shieldRounds = 1;
        actor.reputation += 2;
      }
    }

    applyAllianceEffects(players, before, actions, messages);
    ageAlliances(players);
    players.forEach(p => { p.shieldRounds = Math.max(0, p.shieldRounds - 1); });

    const attackedNames = Array.from(attackedIds).map(id => byId.get(id)?.name).filter(Boolean);
    const attackedText = attackedNames.length > 0
      ? `اللاعبون الذين تعرضوا للاستهداف/الهجوم هذه الجولة: ${attackedNames.join('، ')}.`
      : 'لم يتعرض أي لاعب لهجوم مباشر في هذه الجولة.';

    const trueCulprit = crimes.length ? crimes[Math.floor(Math.random() * crimes.length)].culpritId : null;

    let courtCase = {
      title: 'تقرير الجولة الأمني',
      attackedText,
      trueCulpritId: trueCulprit,
      clue: 'الأجواء هادئة ظاهرياً، ولكن الشبهات والشائعات الغامضة تدور في الظلال بلا أدلة قاطعة وقد تكون مضللة.',
      confidence: 50
    };

    if (crimes.length) {
      const prompt = `صيغ تلميحاً غامضاً أو شبهة ظنية كدليل قضية في المحكمة السرية. 
شروط صارمة:
1. يمنع ذكر أي اسم لاعب نهائياً.
2. اجعل الدليل مجرد شبهة أو ظنون ظرفية بدون برهان قاطع.
3. قد يكون التلميح مضللاً تماماً أو تشير إلى أدلة واهية (مثل: العثور على رسالة ممزقة قرب القاعة، أثر قدم غامض، همسة غير موثوقة).
أعد JSON صالح فقط: {"clue":"النص","confidence":45}`;

      const raw = await openRouter(prompt, 200);
      try {
        const ai = raw ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : null;
        if (ai?.clue) {
          courtCase.clue = String(ai.clue).slice(0, 400);
          courtCase.confidence = Math.max(10, Math.min(90, Number(ai.confidence) || 50));
        }
      } catch {}
    }

    const pendingOffers = {};
    for (const [key, value] of Object.entries(messages)) {
      if (key.startsWith('offers:')) {
        pendingOffers[key.slice(7)] = value;
        delete messages[key];
      }
    }

    return json(res, 200, {
      players,
      pendingMessages: messages,
      pendingOffers,
      courtCase,
      ai: { enabled: Boolean(process.env.OPENROUTER_KEY) }
    });
  }

  if (action === 'resolve_vote') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const culpritId = body.trueCulpritId == null ? null : idOf(body.trueCulpritId);
    const votes = Array.isArray(body.votes) ? body.votes : [];
    const tally = {};

    for (const vote of votes) {
      const voter = byId.get(idOf(vote.voterId));
      if (!active(voter)) continue;
      const accusedId = vote.accusedId == null ? 'NONE' : idOf(vote.accusedId);
      tally[accusedId] = (tally[accusedId] || 0) + 1;
    }

    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NONE';
    let verdictMsg;

    if (winner === culpritId && culpritId !== null) {
      const culprit = byId.get(culpritId);
      if (culprit) culprit.reputation = Math.max(0, culprit.reputation - 4);
      verdictMsg = 'الحكم أصاب المشتبه به الرئيسي وطُبقت عقوبة خفض السمعة.';
    } else {
      const wrong = byId.get(winner);
      if (wrong) wrong.reputation += 2;
      verdictMsg = winner === 'NONE' && culpritId === null
        ? 'تصويت متوازن: أيد الجمهور عدم وجود دليل إدانة.'
        : 'لم يصب الحكم الهدف بدقة؛ حصل المتهم على نقاط رد اعتبار.';
    }

    return json(res, 200, {
      players,
      verdictMsg,
      finalEvidence: {
        confidence: culpritId ? 55 : 80,
        conclusion: 'تظل الشبهات والقرائن قائمة كظنون دون يقين مطلق.',
        note: 'هذه الأدلة ظنية وقد تكون مضللة.'
      }
    });
  }

  return json(res, 400, { error: 'UNKNOWN_ACTION' });
}

export default async function api(req, res) {
  try { return await handler(req, res); }
  catch (error) {
    console.error(error);
    return json(res, 500, { error: 'SERVER_ERROR', message: 'حدث خطأ في الخادم.' });
  }
}
