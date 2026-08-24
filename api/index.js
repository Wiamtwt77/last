const MODEL = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.6';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

// مسبح كافة البطاقات (توحيد السعر بـ 4 نقاط، تشمل البطاقات النافعة والمُخاطرة/المضرة)
const ALL_CARDS = [
  { baseId: 'c1', name: 'بطاقة سرقة', description: 'تسلب 2 نقطة سمعة من الهدف وتحولها إليك.', effectType: 'STEAL', power: 2, targetRequired: true },
  { baseId: 'c2', name: 'بطاقة خصم', description: 'تخصم 2 نقطة سمعة من الهدف مباشرة.', effectType: 'ATTACK', power: 2, targetRequired: true },
  { baseId: 'c3', name: 'بطاقة تشويه سمعة', description: 'توجه أنظار وشكوك تقرير الذكاء الاصطناعي نحو الهدف لتلفيق التهمة له.', effectType: 'DEFAME', power: 0, targetRequired: true },
  { baseId: 'c4', name: 'بطاقة تبديل بطاقة', description: 'تستبدل إحدى بطاقاتك ببطاقة عشوائية جديدة.', effectType: 'SWAP', power: 0, targetRequired: false },
  { baseId: 'c5', name: 'بطاقة قلب الضرر', description: 'تعكس أي هجوم أو سلب ممتلكات موجه إليك ويعود على المهاجم نفسه.', effectType: 'REFLECT', power: 0, targetRequired: false },
  { baseId: 'c6', name: 'بطاقة تدمير التحالف', description: 'تنهي وتدمر أي تحالف قائم للهدف فوراً.', effectType: 'DESTROY_ALLIANCE', power: 0, targetRequired: true },
  { baseId: 'c7', name: 'بطاقة تحالف', description: 'ترسل عرض تحالف سري لمدة 3 جولات تقاسمون فيه أرباح وخسائر السمعة.', effectType: 'ALLIANCE_OFFER', power: 0, targetRequired: true },
  { baseId: 'c8', name: 'بطاقة رسالة سرية', description: 'إرسال رسالة خاصة ومباشرة للاعب آخر دون كشفك.', effectType: 'MESSAGE', power: 0, targetRequired: true },
  { baseId: 'c9', name: 'بطاقة تعزيز نفوذ', description: 'تمنحك 2 نقطة سمعة إضافية فوراً.', effectType: 'BOOST', power: 2, targetRequired: false },
  { baseId: 'c10', name: 'بطاقة كشف أوراق', description: 'تكشف فوراً وفي أوانها جميع البطاقات التي يحملها الهدف.', effectType: 'REVEAL_CARDS', power: 0, targetRequired: true },
  { baseId: 'c11', name: '★ الاستحواذ الشامل', description: 'تسلب 1 نقطة سمعة من جميع اللاعبين وتحولها لحسابك.', effectType: 'RARE_STEAL_ALL', power: 1, targetRequired: false },
  { baseId: 'c12', name: '★ ضربة العرش القاضية', description: 'تخصم 5 نقاط سمعة كاملة من هدف واحد.', effectType: 'RARE_NUKE', power: 5, targetRequired: true },
  { baseId: 'c13', name: '★ التمكين الملكي', description: 'تمنحك 5 نقاط سمعة فوراً لتصدر المشهد.', effectType: 'RARE_MEGA_BOOST', power: 5, targetRequired: false },
  { baseId: 'c14', name: '★ مجازفة العرش (قد تضرك)', description: 'خصم 3 نقاط سمعة منك وتوزيعها على أعدائك!', effectType: 'SELF_HARM', power: 3, targetRequired: false }
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
    reputation: Math.max(0, Math.min(100, Number(raw?.reputation) || 0)),
    cards: Array.isArray(raw?.cards) ? raw.cards.slice(0, 3) : [], // حد أقصى 3 بطاقات
    allyId: raw?.allyId ? idOf(raw.allyId) : null,
    allyRoundsLeft: Math.max(0, Number(raw?.allyRoundsLeft) || 0)
  }));
}

function playerMap(players) { return new Map(players.map(p => [p.id, p])); }

function getRandomCards(count) {
  const shuffled = [...ALL_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(c => ({ ...c, id: uniqueId('card') }));
}

async function openRouter(prompt) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(OPENROUTER, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Secret Court' },
      body: JSON.stringify({
        model: MODEL, temperature: 0.85, max_tokens: 300,
        messages: [
          { 
            role: 'system', 
            content: 'أنت المحقق والقاضي الرئيسي في محكمة سريّة. اكتب تقريراً استخباراتياً درامياً يتكيف حصراً مع أحداث الجولة الموضحة أمامك. إذا تم استخدام تشويه سمعة اتهم المستهدف مباشرة. لا تستخدم ردوداً جاهزة أبداً. أعد JSON صالحاً فقط.' 
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

function dynamicFallbackReport(logs, defamed) {
  if (defamed.length > 0) {
    return `تحوم الشكوك والدلائل القاطعة هذا المساء حول ${defamed.join(' و ')}، حيث تشير تحركات الكواليس إلى تدبير مؤامرات لإضعاف البلاط.`;
  }
  if (logs.length > 0) {
    return `شهدت هذه الجولة تحركات مشبوهة واشتباكات سريّة؛ حيث تم رصد ${logs[0]}`;
  }
  return `ساد الهدوء الحذر أروقة المحكمة خلال هذه الجولة، لكن الهمسات تؤكد أن الصمت ما هو إلا تمهيد لعاصفة قادمة.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body || {};
  const action = body.action;

  // 1. بداية اللعبة فقط: توزيع بطاقتين عشوائيتين لكل لاعب
  if (action === 'start_game') {
    const rawPlayers = Array.isArray(body.players) ? body.players : [];
    const players = rawPlayers.map((p, index) => ({
      id: idOf(p?.id || `player-${index + 1}`),
      name: String(p?.name || `لاعب ${index + 1}`).slice(0, 40),
      reputation: Number(p?.reputation) || 10,
      cards: getRandomCards(2), // بطاقتان عشوائيتان في البداية فقط
      allyId: null,
      allyRoundsLeft: 0
    }));
    return json(res, 200, { players });
  }

  // 2. كشف البطاقات فوراً وفي أوانها
  if (action === 'reveal_target_cards') {
    const players = normalizePlayers(body.players);
    const target = players.find(p => p.id === idOf(body.targetId));
    if (!target) return json(res, 400, { error: 'TARGET_NOT_FOUND' });
    
    return json(res, 200, { 
      targetName: target.name,
      cards: target.cards 
    });
  }

  // 3. شراء بطاقة (السعر موحد: 4 نقاط / الحد الأقصى لليد 3 بطاقات)
  if (action === 'buy_card') {
    const players = normalizePlayers(body.players);
    const buyer = players.find(p => p.id === idOf(body.playerId));
    
    if (!buyer || buyer.reputation < 4) {
      return json(res, 400, { error: 'INSUFFICIENT_REPUTATION', message: 'شراء البطاقة يتطلب 4 نقاط سمعة على الأقل.' });
    }
    if (buyer.cards.length >= 3) {
      return json(res, 400, { error: 'HAND_FULL', message: 'لا يمكنك امتلاك أكثر من 3 بطاقات في يدك.' });
    }

    buyer.reputation -= 4;
    const newCard = getRandomCards(1)[0];
    buyer.cards.push(newCard);

    return json(res, 200, { players, boughtCard: newCard });
  }

  // 4. معالجة أحداث الجولة وإصدار التقرير الديناميكي
  if (action === 'resolve_round') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const messages = copy(body.pendingMessages) || {};
    const actions = Array.isArray(body.actions) ? body.actions : [];

    const defamedTargets = [];
    const crimes = [];
    const reflectSet = new Set();
    const roundLogs = [];

    // إعداد دروع الحماية
    for (const act of actions) {
      const actor = byId.get(idOf(act.playerId));
      if (!active(actor) || !act.usedCard) continue;
      if (act.usedCard.effectType === 'REFLECT') {
        reflectSet.add(actor.id);
        roundLogs.push(`استخدام درع تعكيس الضرر لحماية أحد النبلاء.`);
      }
    }

    // تنفيذ أفعال البطاقات وإزالتها من يد اللاعب فقط بعد الاستخدام
    for (const act of actions) {
      const actor = byId.get(idOf(act.playerId));
      const card = act.usedCard;
      const target = act.targetId ? byId.get(idOf(act.targetId)) : null;

      if (!active(actor) || !card) continue;

      // إزالة البطاقة المستخدمة من يد اللاعب
      actor.cards = actor.cards.filter(c => c.id !== card.id);

      if (card.targetRequired && (!target || target.id === actor.id || !active(target))) continue;

      switch (card.effectType) {
        case 'ATTACK':
        case 'RARE_NUKE': {
          const power = card.power;
          if (reflectSet.has(target.id)) {
            actor.reputation = Math.max(0, actor.reputation - power);
            roundLogs.push(`محاولة هجوم على ${target.name} وانعكس الضرر مباشرة على المهاجم.`);
          } else {
            target.reputation = Math.max(0, target.reputation - power);
            roundLogs.push(`هجوم مباشر أدى لاستنزاف سمعة ${target.name}.`);
          }
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'STEAL': {
          if (reflectSet.has(target.id)) {
            const amt = Math.min(card.power, actor.reputation);
            actor.reputation -= amt;
            target.reputation += amt;
            roundLogs.push(`محاولة سرقة من ${target.name} وانعكست الخسارة على المهاجم.`);
          } else {
            const amt = Math.min(card.power, target.reputation);
            target.reputation -= amt;
            actor.reputation += amt;
            roundLogs.push(`تمت سرقة نقاط سمعة ونفوذ من ${target.name}.`);
          }
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'DEFAME': {
          defamedTargets.push(target.name);
          roundLogs.push(`حملة تشويه سمعة وتلفيق تهم موجهة مباشرة ضد ${target.name}.`);
          crimes.push({ culpritId: actor.id, targetId: target.id });
          break;
        }
        case 'SELF_HARM': {
          actor.reputation = Math.max(0, actor.reputation - card.power);
          roundLogs.push(`تأثير عكسي لبطاقة مجازفة أدى لخسارة ${actor.name} لنفوذه.`);
          break;
        }
        case 'DESTROY_ALLIANCE': {
          if (target.allyId) {
            const partner = byId.get(target.allyId);
            if (partner) { partner.allyId = null; partner.allyRoundsLeft = 0; }
            target.allyId = null; target.allyRoundsLeft = 0;
            roundLogs.push(`تدمير وإنهاء التحالف القائم الخاضع لـ ${target.name}.`);
          }
          break;
        }
        case 'BOOST':
        case 'RARE_MEGA_BOOST': {
          actor.reputation += card.power;
          roundLogs.push(`تعزيز نفوذ وتدعيم سمعة لصالح ${actor.name}.`);
          break;
        }
        case 'RARE_STEAL_ALL': {
          players.forEach(p => {
            if (p.id !== actor.id && active(p) && p.reputation > 0) {
              p.reputation -= 1;
              actor.reputation += 1;
            }
          });
          roundLogs.push(`استحواذ شامل ألحق الضرر بجميع الجالسين في المجلس.`);
          break;
        }
      }
    }

    // صياغة تقرير الذكاء الاصطناعي المباشر والديناميكي
    const prompt = `أحداث هذه الجولة الحقيقية:
${roundLogs.length ? roundLogs.map(l => `- ${l}`).join('\n') : '- هدوء تام وتبادل نظرات حذرة.'}

المستهدفون بتشويه السمعة وتلفيق التهم: [${defamedTargets.join('، ') || 'لا يوجد'}]

اكتب تقريراً استخباراتياً درامياً متكيفاً كلياً مع الأحداث أعلاه، وتوجيه أصابع الاتهام والتهم نحو المستهدفين بالتحديد.
أعد JSON بالشكل التالي:
{"clue": "نص التقرير الديناميكي", "confidence": 75}`;

    let reportText = '';
    let confidence = 70;

    const raw = await openRouter(prompt);
    try {
      const ai = raw ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : null;
      if (ai?.clue) {
        reportText = String(ai.clue).slice(0, 400);
        confidence = Math.max(30, Math.min(95, Number(ai.confidence) || 70));
      }
    } catch {}

    if (!reportText) {
      reportText = dynamicFallbackReport(roundLogs, defamedTargets);
    }

    const trueCulprit = crimes.length ? crimes[Math.floor(Math.random() * crimes.length)].culpritId : null;

    return json(res, 200, {
      players,
      pendingMessages: messages,
      courtCase: {
        title: 'تقرير القاضي الاستخباري',
        trueCulpritId: trueCulprit,
        clue: reportText,
        confidence
      }
    });
  }

  // 5. التصويت الجماعي الموحد
  if (action === 'resolve_group_vote') {
    const players = normalizePlayers(body.players);
    const byId = playerMap(players);
    const culpritId = body.trueCulpritId ? idOf(body.trueCulpritId) : null;
    const accusedId = body.accusedId ? idOf(body.accusedId) : 'NONE';

    let verdictMsg = '';

    if (accusedId === culpritId && culpritId !== null) {
      const culprit = byId.get(culpritId);
      if (culprit) culprit.reputation = Math.max(0, culprit.reputation - 4);
      verdictMsg = `أصاب تصويت المجلس الجماعي الحقيقة! تم إدانة المتهم الحقيقي (${culprit?.name || ''}) وخصم 4 نقاط من سمعته.`;
    } else {
      const innocent = byId.get(accusedId);
      if (innocent) innocent.reputation += 2;
      verdictMsg = `فشل تصويت المجلس وكان الحكم خاطئاً! نال المتهم المظلوم تعويضاً قدره 2 نقطة سمعة.`;
    }

    return json(res, 200, { players, verdictMsg });
  }

  return json(res, 400, { error: 'UNKNOWN_ACTION' });
}
