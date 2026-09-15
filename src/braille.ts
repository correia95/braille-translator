// English Braille (Grade 1 / uncontracted) translator. Pure, dependency-free.
//
// Six-dot cell numbering (standard):
//   1 4
//   2 5
//   3 6
// Unicode's Braille Patterns block (U+2800-U+28FF) encodes each dot as a bit in the codepoint
// offset from U+2800, in exactly this order: dot1=bit0, dot2=bit1, dot3=bit2, dot4=bit3,
// dot5=bit4, dot6=bit5 — so a dot list converts directly to a Unicode character with no lookup
// table needed for the visual glyph itself.

export type Dots = number[]; // e.g. [1, 4, 5] for 'd'

const BRAILLE_BASE = 0x2800;

export function dotsToChar(dots: Dots): string {
  let bits = 0;
  for (const d of dots) bits |= 1 << (d - 1);
  return String.fromCodePoint(BRAILLE_BASE + bits);
}

export function charToDots(char: string): Dots {
  const code = char.codePointAt(0) ?? BRAILLE_BASE;
  const bits = code - BRAILLE_BASE;
  const dots: Dots = [];
  for (let i = 0; i < 6; i++) {
    if (bits & (1 << i)) dots.push(i + 1);
  }
  return dots;
}

// Letters a-j share their dot pattern with digits 1-9 and 0 (j=0), per the standard convention of
// prefixing a digit run with the "number sign".
const LETTER_DOTS: Record<string, Dots> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
};

// Digit 1-9,0 reuse letters a-j in that order.
const DIGIT_LETTER: Record<string, string> = {
  '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j',
};

const PUNCTUATION_DOTS: Record<string, Dots> = {
  ',': [2],
  ';': [2, 3],
  ':': [2, 5],
  '.': [2, 5, 6],
  '!': [2, 3, 5],
  '?': [2, 3, 6],
  "'": [3],
  '-': [3, 6],
};

const CAPITAL_SIGN: Dots = [6];
const NUMBER_SIGN: Dots = [3, 4, 5, 6];

export interface EncodedCell {
  sourceChar: string; // the original character (or '#'/'CAP' marker) this cell represents
  dots: Dots;
  char: string; // the rendered Unicode Braille character
}

// Encodes plain text into a sequence of Braille cells, inserting the capital sign before an
// uppercase letter and the number sign before a run of digits, per standard Grade 1 convention.
export function encodeText(text: string): EncodedCell[] {
  const cells: EncodedCell[] = [];
  let inNumberRun = false;

  for (const ch of text) {
    if (ch === ' ') {
      cells.push({ sourceChar: ' ', dots: [], char: dotsToChar([]) });
      inNumberRun = false;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      if (!inNumberRun) {
        cells.push({ sourceChar: '#', dots: NUMBER_SIGN, char: dotsToChar(NUMBER_SIGN) });
        inNumberRun = true;
      }
      const letter = DIGIT_LETTER[ch];
      const dots = LETTER_DOTS[letter];
      cells.push({ sourceChar: ch, dots, char: dotsToChar(dots) });
      continue;
    }
    inNumberRun = false;

    if (/[a-zA-Z]/.test(ch)) {
      const lower = ch.toLowerCase();
      if (ch !== lower) {
        cells.push({ sourceChar: '↑', dots: CAPITAL_SIGN, char: dotsToChar(CAPITAL_SIGN) });
      }
      const dots = LETTER_DOTS[lower];
      cells.push({ sourceChar: lower, dots, char: dotsToChar(dots) });
      continue;
    }

    if (PUNCTUATION_DOTS[ch]) {
      cells.push({ sourceChar: ch, dots: PUNCTUATION_DOTS[ch], char: dotsToChar(PUNCTUATION_DOTS[ch]) });
      continue;
    }

    // Unsupported character (e.g. punctuation outside the small set above): pass through as a
    // blank cell rather than silently dropping it, so the output length still tracks the input.
    cells.push({ sourceChar: ch, dots: [], char: dotsToChar([]) });
  }

  return cells;
}

export function encodeToBrailleString(text: string): string {
  return encodeText(text)
    .map((c) => c.char)
    .join('');
}

const DOTS_KEY_TO_LETTER = new Map<string, string>(Object.entries(LETTER_DOTS).map(([letter, dots]) => [dotsKey(dots), letter]));
const DOTS_KEY_TO_PUNCT = new Map<string, string>(Object.entries(PUNCTUATION_DOTS).map(([p, dots]) => [dotsKey(dots), p]));
const LETTER_TO_DIGIT = new Map<string, string>(Object.entries(DIGIT_LETTER).map(([digit, letter]) => [letter, digit]));

function dotsKey(dots: Dots): string {
  return [...dots].sort((a, b) => a - b).join(',');
}

// Decodes a Braille Unicode string back to plain text, honoring capital-sign and number-sign
// prefixes. Unrecognized cells decode to '?'.
export function decodeBrailleString(input: string): string {
  let result = '';
  let capitalizeNext = false;
  let inNumberRun = false;

  for (const ch of input) {
    const dots = charToDots(ch);
    const key = dotsKey(dots);

    if (dots.length === 0) {
      result += ' ';
      capitalizeNext = false;
      inNumberRun = false;
      continue;
    }
    if (key === dotsKey(CAPITAL_SIGN)) {
      capitalizeNext = true;
      continue;
    }
    if (key === dotsKey(NUMBER_SIGN)) {
      inNumberRun = true;
      continue;
    }

    const letter = DOTS_KEY_TO_LETTER.get(key);
    if (letter !== undefined) {
      if (inNumberRun) {
        const digit = LETTER_TO_DIGIT.get(letter);
        result += digit ?? '?';
      } else {
        result += capitalizeNext ? letter.toUpperCase() : letter;
      }
      capitalizeNext = false;
      continue;
    }

    const punct = DOTS_KEY_TO_PUNCT.get(key);
    if (punct !== undefined) {
      result += punct;
      capitalizeNext = false;
      inNumberRun = false;
      continue;
    }

    result += '?';
    capitalizeNext = false;
    inNumberRun = false;
  }

  return result;
}

export function supportedCharacters(): string {
  return 'a-z, A-Z, 0-9, space, , ; : . ! ? \' -';
}

// --- URL state -----------------------------------------------------------

export type Mode = 'toBraille' | 'toText';

export interface State {
  text: string;
  mode: Mode;
}

export function encodeState(state: State): URLSearchParams {
  const p = new URLSearchParams();
  p.set('t', state.text);
  p.set('m', state.mode === 'toText' ? 'b2t' : 't2b');
  return p;
}

export function decodeState(params: URLSearchParams, fallback: State): State {
  const text = params.get('t') ?? fallback.text;
  const modeRaw = params.get('m');
  const mode: Mode = modeRaw === 'b2t' ? 'toText' : modeRaw === 't2b' ? 'toBraille' : fallback.mode;
  return { text, mode };
}
