/**
 * Jamaican patois phrases used throughout the game for flavor.
 * Source: common Jamaican sayings and expressions.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Game start greeting ─────────────────────────────────────────────────

const GREETINGS = [
  "Wah gwaan! Let's play!",
  "Irie! Time fi roll!",
  "One love, bredda. Let's go!",
  "Bless up! Game time!",
  "Weh yuh ah seh? Let's play!",
];

export function greetingMessage(): string {
  return pick(GREETINGS);
}

// ── Greetings / turn start ──────────────────────────────────────────────

const TURN_START = [
  "Wah gwaan! Your roll!",
  "Yuh dun know — time fi roll!",
  "Pon di ting! Roll dem dice!",
  "Weh yuh deh pon? Roll up!",
  "Bless up — your turn!",
  "Irie vibes, your move!",
  "Click fi roll, bredda!",
];

export function turnStartMessage(): string {
  return pick(TURN_START);
}

// ── Waiting / searching ─────────────────────────────────────────────────

const WAITING = [
  "Mi soon come...",
  "Lickkle more...",
  "Inna di morrows we play!",
  "One love — hold tight...",
  "Mi deh yah, yuh know...",
  "Easy nuh, mi soon come...",
];

export function waitingMessage(): string {
  return pick(WAITING);
}

// ── AI thinking ─────────────────────────────────────────────────────────

const AI_THINKING = [
  "{name} deh pon it...",
  "{name} a reason...",
  "{name}: \"Zeen, zeen...\"",
  "{name}: \"Mi soon come...\"",
  "{name} a ponder di ting...",
];

export function aiThinkingMessage(name: string): string {
  return pick(AI_THINKING).replace("{name}", name);
}

// ── AI no moves ─────────────────────────────────────────────────────────

const AI_NO_MOVES = [
  "{name}: \"If a dirt, a dirt!\"",
  "{name}: \"KMT!\" No moves!",
  "{name} mash up! No moves!",
];

export function aiNoMovesMessage(name: string): string {
  return pick(AI_NO_MOVES).replace("{name}", name);
}

// ── Victory ─────────────────────────────────────────────────────────────

const VICTORY = [
  "Ya mon! Nuff respect!",
  "Yu large! Big win!",
  "Bless up! Ya mon!",
  "One love! Victory!",
  "Irie! You mash it up!",
  "Dead wid laugh! You win!",
  "Every mikkle mek a mukkle! Ya mon!",
];

export function victoryMessage(): string {
  return pick(VICTORY);
}

// ── Defeat ──────────────────────────────────────────────────────────────

const DEFEAT = [
  "If a dirt, a dirt...",
  "Lickkle more, bredda...",
  "Bun bad mind — try again!",
  "De olda de moon, de brighter it shines...",
  "Talk and taste your tongue next time!",
  "Every hoe have dem stik a bush...",
];

export function defeatMessage(): string {
  return pick(DEFEAT);
}

// ── Piece hit ───────────────────────────────────────────────────────────

const HIT_FLAVOR = [
  "Mash up!",
  "To Babylon!",
  "KMT!",
  "Sake a mout!",
];

export function hitFlavorMessage(): string {
  return pick(HIT_FLAVOR);
}

// ── Bear off ────────────────────────────────────────────────────────────

const BEAR_OFF_FLAVOR = [
  "Zeen! To Zion!",
  "One more home!",
  "Irie!",
];

export function bearOffFlavorMessage(): string {
  return pick(BEAR_OFF_FLAVOR);
}

// ── Double offered ──────────────────────────────────────────────────────

const DOUBLE_OFFERED = [
  "{name}: \"Yuh dun know?\"",
  "{name}: \"Yu large enough fi dis?\"",
  "{name} considers the double...",
];

export function doubleConsiderMessage(name: string): string {
  return pick(DOUBLE_OFFERED).replace("{name}", name);
}

const DOUBLE_ACCEPTED = [
  "{name}: \"Ya mon! Bring it!\"",
  "{name}: \"Zeen!\" Accepted!",
  "{name}: \"Pon di ting!\" Accepted!",
];

export function doubleAcceptedMessage(name: string): string {
  return pick(DOUBLE_ACCEPTED).replace("{name}", name);
}

const DOUBLE_DECLINED = [
  "{name}: \"Inner luv, but no.\"",
  "{name}: \"Mi soon come back stronger!\"",
  "{name} declines! You win!",
];

export function doubleDeclinedMessage(name: string): string {
  return pick(DOUBLE_DECLINED).replace("{name}", name);
}

// ── No moves (human) ───────────────────────────────────────────────────

const NO_MOVES_HUMAN = [
  "If a dirt, a dirt! No moves...",
  "KMT! No legal moves!",
  "Mash up — no moves!",
];

export function noMovesMessage(): string {
  return pick(NO_MOVES_HUMAN);
}
