const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.6';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

// مسبح البطاقات الموحد (جميعها تُشترى بـ 4 نقاط، منها المفيد ومنها الخطير)
const UNIFIED_CARDS = [
  { baseId: 'c1', name: 'بطاقة سرقة', description: 'تسلب 2 نقطة سمعة من الهدف وتحولها إليك.', effectType: 'STEAL', power: 2, targetRequired: true },
  { baseId: 'c2', name: 'بطاقة خصم', description: 'تخصم 2 نقطة سمعة من الهدف مباشرة.', effectType: 'ATTACK', power: 2, targetRequired: true },
  { baseId: 'c3', name: 'بطاقة تشويه سمعة', description: 'توجه الشبهات والاتهامات في التقرير نحو الهدف لتلفيق التهمة له.', effectType: 'DEFAME', power: 0, targetRequired: true },
  { baseId: 'c4', name: 'بطاقة تبديل بطاقة', description: 'تستبدل إحدى بطاقاتك ببطاقة عشوائية جديدة من الحزمة.', effectType: 'SWAP', power: 0, targetRequired: false },
  { baseId: 'c5', name: 'بطاقة قلب الضرر', description: 'تعكس أي هجوم أو سلب موجه إليك ليعود على المهاجم نفسه.', effectType: 'REFLECT', power: 0, targetRequired: false },
  { baseId: 'c6', name: 'بطاقة تدمير التحالف', description: 'تنهي وتدمر أي تحالف قائم للهدف فوراً.', effectType: 'DESTROY_ALLIANCE', power: 0, targetRequired: true },
  { baseId: 'c7', name: 'بطاقة تحالف سري', description: 'تعرض تحالفاً سرياً لمدة 3 جولات لتقاسم أرباح وخسائر السمعة.', effectType: 'ALLIANCE_OFFER', power: 0, targetRequired: true },
  { baseId: 'c8', name: 'بطاقة رسالة سرية', description: 'إرسال رسالة خاصة ومباشرة للاعب آخر دون كشف هويتك.', effectType: 'MESSAGE', power: 0, targetRequired: true },
  { baseId: 'c9', name: 'بطاقة تعزيز نفوذ', description: 'تمنحك 2 نقطة سمعة إضافية فوراً لتصدر المشهد.', effectType: 'BOOST', power: 2, targetRequired: false },
  { baseId: 'c10', name: 'بطاقة كشف بطاقات الخصم', description: 'تكشف بطاقات لاعب آخر في يديه فوراً ودون انتظار.', effectType: 'REVEAL', power: 0, targetRequired: true },
  { baseId: 'c11', name: 'بطاقة خطأ مطبعي (مخاطرة)', description: 'بطاقة مشبوهة ترتد عليك فتخصم 1 نقطة سمعة منك.', effectType: 'BACKFIRE', power: 1, targetRequired: false }
];

const json = (res, code, value) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(code).json(value);
};

const active = p => p && Number(p.reputation) > 0;
const copy = value => JSON.parse(JSON.stringify(value ?? null));
const idOf = value => String(value ?? '');
const uniqueId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function normalizePlayers(input) {
  return (Array.isArray(input) ? input : []).map((raw, index) => ({
    id: idOf(raw?.id || `player-${index + 1}`),
    name: String(raw?.name || `لاعب ${index + 1}`).slice(0, 40),
    reputation: Math.max(0, Math.min(100, Number(raw?.reputation) || 10)),
    cards: Array.isArray(raw?.cards) ? raw.cards : [],
    allyId: raw?.allyId ? idOf(raw.allyId) : null,
    allyRoundsLeft: Math.max(0, Number(raw?.allyRoundsLeft) || 0)
  }));
}

function playerMap(players) { return new Map(players.map(p => [p.id, p])); }

function getRandomCards(count) {
  const shuffled = [...UNIFIED_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(c => ({ ...c, instanceId: uniqueId('card') }));
}

async function openRouter(prompt, maxTokens = 300) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(OPENROUTER, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Secret Court' },
      body: JSON.stringify({
        model: MODEL, temperature: 0.9, max_tokens: maxTokens,
        messages: [
          { 
            role: 'system', 
            content: 'أنت راوي ورئيس محكمة جنائية غامضة في لعبة المحكمة السرية. مهمتك صياغة تقرير استخباري درامي يربط الأحداث الفعلية للجولة ويصوب التهم والشكوك نحو اللاعبين المستهدفين (خصوصاً من تعرضوا لتشويه السمعة). أعد JSON صالحاً فقط بلا Markdown.' 
          },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; } finally { clearTimeout(timer); }
}

function processAllianceShare(players, before) {
  const byId = playerMap(players);
  const processed = new Set();
  for (const p of players) {
    if (!p.allyId || processed.has(p.id)) continue;
    const ally = byId.get(p.allyId);
    if (!ally || ally.allyId !== p.id || !active(p) || !active(ally)) continue;
    processed.add(p.id); processed.add(ally.id);
    const pChange = p.reputation - before[p.id];
    const aChange = ally.reputation - before[ally.id];
    const totalChange = pChange + aChange;
    if (totalChange !== 0) {
      const share = Math.floor(totalChange / 2);
      p.reputation = Math.max(0, before[p.id] + share);
      ally.reputation = Math.max(0, before[ally.id] + (totalChange - share));
    }
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

function triggerGlobalEvent(players) {
  if (Math.random() > 0.45) return null;
  const activePlayers = players.filter(active);
  if (activePlayers.length === 0) return null;
  const sorted = [...activePlayers].sort((a, b) => b.reputation - a.reputation);
  const topPlayer = sorted[0];

  const events = [
    { title: 'ضريبة النفوذ العالية', desc: `تم فرض ضريبة استثنائية على المتصدر! خسارة 3 نقاط سمعة.`, apply: () => { topPlayer.reputation = Math.max(0, topPlayer.reputation - 3); } },
    { title: 'مرسوم براءة عامة', desc: 'صدر مرسوم ملكي بمنح جميع اللاعبين 1 نقطة سمعة إضافية.', apply: () => { activePlayers.forEach(p => p.reputation += 1); } },
    { title: 'كارثة اقتصادية للبلاط', desc: 'تراجع الاستقرار في القصر! خصم 1 نقطة سمعة من كافة اللاعبين.', apply: () => { activePlayers.forEach(p => p.reputation = Math.max(0, p.reputation - 1)); } }
  ];
  const selectedEvent = events[Math.floor(Math.random() * events.length)];
  selectedEvent.apply();
  return { title: selectedEvent.title, description: selectedEvent.desc };
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body || {};
  const action = body.action;

  // 1. بدء اللعبة وتوزيع بطاقتين لكل لاعب
  if (action === 'init_game') {
    const players = normalizePlayers(body.players);
    players.forEach(p => {
      p.cards = getRandomCards(2);
    });
    return json(res, 200, { players });
  }

  // 2. شراء بطاقة (بسعر موحد 4 نقاط، وبحد أقصى 3 بطاقات في اليد)
  if (action === 'buy_card') {
    const players = normalizePlayers(body.players);
    const buyer = players.find(p => p.id === idOf(body.playerId));
    if (!buyer) return json(res, 400, { error: 'PLAYER_NOT_FOUND' });
    if (buyer.cards.length >= 3) {
      return json(res, 400, { error: 'MAX_CARDS', message: 'عذراً، الحد الأقصى لامتلاك البطاقات هو 3 بطاقات فقط.' });
    }
    if (buyer.reputation <= 4) {
      return json(res, 400, { error: 'INSUFFICIENT_REPUTATION', message: 'شراء البطاقات يتطلب أكثر من 4 نقاط سمعة.' });
    }
    buyer.reputation -= 4;
    const newCard = getRandomCards(1)[0];
    buyer.cards.push(newCard);
    return json(res, 200, { players, boughtCard: newCard });
  }

  // 3. تنفيذ الجولة وأحداثها
  if (action === 'resolve_round') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const messages = copy(body.pendingMessages) || {};
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const before = Object.fromEntries(players.map(p => [p.id, p.reputation]));

    const defamedTargets = [];
    const crimes = [];
    const reflectSet = new Set();
    const roundEventLogs = [];

    // استهلاك البطاقة المستخدمة من يد اللاعب
    for (const act of actions) {
      const actor = byId.get(idOf(act.playerId));
      if (!actor || !act.usedCardInstanceId) continue;
      actor.cards = actor.cards.filter(c => c.instanceId !== act.usedCardInstanceId);
    }

    // مرحلة الحماية وعكس الضرر
    for (const act of actions) {
      const actor = byId.get(idOf(act.playerId));
      if (!active(actor) || !act.card) continue;
      if (act.card.effectType === 'REFLECT') {
        reflectSet.add(actor.id);
        roundEventLogs.push(`تفعيل درع عكس الضرر لحماية ${actor.name}.`);
      }
    }

    // تنفيذ تأثيرات البطاقات
    for (const act of actions) {
      const actor = byId.get(idOf(act.playerId));
      const card = act.card;
      const target = act.targetId ? byId.get(idOf(act.targetId)) : null;

      if (!active(actor) || !card) continue;
      if (card.targetRequired && (!target || target.id === actor.id || !active(target))) continue;

      switch (card.effectType) {
        case 'ATTACK': {
          const power = card.power;
          if (reflectSet.has(target.id)) {
            actor.reputation = Math.max(0, actor.reputation - power);
            roundEventLogs.push(`محاولة هجوم من ${actor.name} على ${target.name} وانعكس الضرر على المهاجم.`);
          } else {
            target.reputation = Math.max(0, target.reputation - power);
            roundEventLogs.push(`ضربة استنزاف سمعة وجهها ${actor.name} ضد ${target.name}.`);
          }
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'STEAL': {
          if (reflectSet.has(target.id)) {
            const amount = Math.min(card.power, actor.reputation);
            actor.reputation -= amount;
            target.reputation += amount;
            roundEventLogs.push(`محاولة سرقة من ${actor.name} وانعكست على المهاجم.`);
          } else {
            const amount = Math.min(card.power, target.reputation);
            target.reputation -= amount;
            actor.reputation += amount;
            roundEventLogs.push(`سرقة نقاط سمعة نفذها ${actor.name} من ${target.name}.`);
          }
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'DEFAME': {
          defamedTargets.push(target.name);
          roundEventLogs.push(`حملة تشويه سمعة وتلفيق اتهامات موجهة ضد ${target.name}.`);
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'DESTROY_ALLIANCE': {
          if (target.allyId) {
            const partner = byId.get(target.allyId);
            if (partner) { partner.allyId = null; partner.allyRoundsLeft = 0; }
            target.allyId = null; target.allyRoundsLeft = 0;
            roundEventLogs.push(`تم تدمير وإنهاء تحالف ${target.name}.`);
          }
          break;
        }
        case 'ALLIANCE_OFFER': {
          if (!target.allyId && !actor.allyId) {
            if (!messages[target.id]) messages[target.id] = [];
            messages[target.id].push({
              id: uniqueId('msg'), kind: 'alliance_offer',
              fromId: actor.id, fromName: actor.name,
              text: `عرض تحالف سري من ${actor.name} لمدة 3 جولات.`
            });
            roundEventLogs.push(`تقديم عرض تحالف سري في الكواليس.`);
          }
          break;
        }
        case 'MESSAGE': {
          if (!messages[target.id]) messages[target.id] = [];
          messages[target.id].push({
            id: uniqueId('msg'), kind: 'private_msg',
            fromName: actor.name,
            text: String(act.text || 'رسالة سرية غامضة').slice(0, 300)
          });
          roundEventLogs.push(`تبادل رسالة سرية بين الأروقة.`);
          break;
        }
        case 'BOOST': {
          actor.reputation += card.power;
          roundEventLogs.push(`قام ${actor.name} بتعزيز نفوذه وسمعته.`);
          break;
        }
        case 'BACKFIRE': {
          actor.reputation = Math.max(0, actor.reputation - card.power);
          roundEventLogs.push(`وقوع ${actor.name} ضحية بطاقة مشبوهة ارتدت عليه.`);
          break;
        }
      }
    }

    processAllianceShare(players, before);
    ageAlliances(players);
    const globalEvent = triggerGlobalEvent(players);

    const trueCulprit = crimes.length ? crimes[Math.floor(Math.random() * crimes.length)].culpritId : null;
    let courtCase = {
      title: 'تقرير المحكمة الاستخباري',
      trueCulpritId: trueCulprit,
      clue: 'الأجواء ملغومة بالشكوك وتحركات مريبة في أروقة القصر.',
      confidence: 65,
      globalEvent
    };

    // صياغة تقرير الذكاء الاصطناعي الديناميكي المربوط بأحداث الجولة وتشويه السمعة
    const prompt = `أحداث هذه الجولة الفعلية في المحكمة السرية:
${roundEventLogs.length ? roundEventLogs.map(e => `- ${e}`).join('\n') : '- جولة هادئة نسبياً.'}

اللاعبون المستهدفون بتشويه السمعة وتلفيق التهم: [${defamedTargets.join('، ') || 'لا يوجد مستهدف مباشر'}] (يجب أن يوجه التقرير أصابع الشبهات والتهم نحوهم بصورة رئيسية!).

اكتب تقريراً جنائياً درامياً ومثيراً يربط هذه الأحداث ويصوب الاتهامات بدقة.
أعد JSON بالشكل التالي فقط:
{"clue": "نص التقرير المحبوك المشوق", "confidence": 75}`;

    const raw = await openRouter(prompt, 280);
    try {
      const ai = raw ? JSON.parse(raw.replace(/```json|
