// Spaced repetition for practice mode: FSRS-6, the scheduler Anki uses, ported from py-fsrs
// (github.com/open-spaced-repetition/py-fsrs) with its default parameters, learning steps
// and interval fuzz. Times are epoch milliseconds; ratings are 1 Again, 2 Hard, 3 Good, 4 Easy.
//
// A card is { state, step, s, d, due, last }: state is "learning", "review" or "relearning",
// step indexes the (re)learning steps, s is stability in days and d is difficulty (1 to 10).
(function (root) {
  const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
    1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
  const DECAY = -W[20];
  const FACTOR = 0.9 ** (1 / DECAY) - 1;
  const RETENTION = 0.9;
  const MAX_INTERVAL = 36500; // days
  const MINUTE = 60e3, DAY = 864e5;
  const LEARNING_STEPS = [1 * MINUTE, 10 * MINUTE];
  const RELEARNING_STEPS = [10 * MINUTE];
  const FUZZ_RANGES = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]]; // [start, end, factor] in days

  const clampD = d => Math.min(Math.max(d, 1), 10);
  const clampS = s => Math.max(s, 0.001);
  const initialStability = g => clampS(W[g - 1]);
  const initialDifficulty = g => W[4] - Math.exp(W[5] * (g - 1)) + 1;

  function nextInterval(s) {
    const days = Math.round((s / FACTOR) * (RETENTION ** (1 / DECAY) - 1));
    return Math.min(Math.max(days, 1), MAX_INTERVAL);
  }

  function shortTermStability(s, g) {
    let inc = Math.exp(W[17] * (g - 3 + W[18])) * s ** -W[19];
    if (g > 1) inc = Math.max(inc, 1);
    return clampS(s * inc);
  }

  function nextDifficulty(d, g) {
    const delta = -W[6] * (g - 3);
    const damped = d + ((10 - d) * delta) / 9;
    return clampD(W[7] * initialDifficulty(4) + (1 - W[7]) * damped);
  }

  function nextStability(d, s, r, g) {
    if (g === 1) {
      const longTerm = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp((1 - r) * W[14]);
      return clampS(Math.min(longTerm, s / Math.exp(W[17] * W[18])));
    }
    const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
    return clampS(s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp((1 - r) * W[10]) - 1) * hard * easy));
  }

  // Chance of remembering the card now.
  function retrievability(card, now) {
    if (card.last == null || card.s == null) return 0;
    const days = Math.max(0, Math.floor((now - card.last) / DAY));
    return (1 + (FACTOR * days) / card.s) ** DECAY;
  }

  // Spread review intervals a little so cards learned together don't stay together.
  function fuzz(days, random) {
    if (days < 2.5) return days;
    let delta = 1;
    for (const [start, end, factor] of FUZZ_RANGES) delta += factor * Math.max(Math.min(days, end) - start, 0);
    let lo = Math.max(2, Math.round(days - delta));
    const hi = Math.min(Math.round(days + delta), MAX_INTERVAL);
    lo = Math.min(lo, hi);
    return Math.min(Math.round(random() * (hi - lo + 1) + lo), MAX_INTERVAL);
  }

  function newCard() {
    return { state: "learning", step: 0, s: null, d: null, due: 0, last: null };
  }

  function review(card, g, now, { useFuzz = true, random = Math.random } = {}) {
    card = { ...card };
    const sameDay = card.last != null && Math.floor((now - card.last) / DAY) < 1;
    const update = () => {
      card.s = sameDay ? shortTermStability(card.s, g) : nextStability(card.d, card.s, retrievability(card, now), g);
      card.d = nextDifficulty(card.d, g);
    };
    let interval; // ms
    const graduate = () => { card.state = "review"; card.step = null; interval = nextInterval(card.s) * DAY; };

    if (card.state === "review") {
      update();
      if (g === 1 && RELEARNING_STEPS.length) { card.state = "relearning"; card.step = 0; interval = RELEARNING_STEPS[0]; }
      else interval = nextInterval(card.s) * DAY;
    } else {
      const steps = card.state === "learning" ? LEARNING_STEPS : RELEARNING_STEPS;
      if (card.s == null || card.d == null) { card.s = initialStability(g); card.d = clampD(initialDifficulty(g)); }
      else update();
      if (!steps.length || (card.step >= steps.length && g > 1)) graduate();
      else if (g === 1) { card.step = 0; interval = steps[0]; }
      else if (g === 2) interval = card.step === 0 ? (steps.length === 1 ? steps[0] * 1.5 : (steps[0] + steps[1]) / 2) : steps[card.step];
      else if (g === 3) { if (card.step + 1 === steps.length) graduate(); else { card.step++; interval = steps[card.step]; } }
      else graduate();
    }
    if (useFuzz && card.state === "review") interval = fuzz(interval / DAY, random) * DAY;
    card.due = now + interval;
    card.last = now;
    return card;
  }

  const api = { review, newCard, retrievability, MINUTE, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SRS = api;
})(this);
