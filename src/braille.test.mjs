import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dotsToChar,
  charToDots,
  encodeText,
  encodeToBrailleString,
  decodeBrailleString,
  encodeState,
  decodeState,
} from './braille.ts';

test('dotsToChar/charToDots round-trip for every dot combination 0-63', () => {
  for (let bits = 0; bits < 64; bits++) {
    const dots = [];
    for (let i = 0; i < 6; i++) if (bits & (1 << i)) dots.push(i + 1);
    const char = dotsToChar(dots);
    const back = charToDots(char);
    assert.deepEqual([...back].sort(), [...dots].sort());
  }
});

test("dotsToChar produces the well-known Unicode codepoints for 'a', 'b' and 'z'", () => {
  assert.equal(dotsToChar([1]).codePointAt(0), 0x2801); // a
  assert.equal(dotsToChar([1, 2]).codePointAt(0), 0x2803); // b
  assert.equal(dotsToChar([1, 3, 5, 6]).codePointAt(0), 0x2835); // z
});

test('every letter a-z produces a distinct dot pattern (no accidental duplicates)', () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const seen = new Set();
  for (const letter of letters) {
    const cell = encodeText(letter)[0];
    const key = [...cell.dots].sort((a, b) => a - b).join(',');
    assert.equal(seen.has(key), false, `letter "${letter}" duplicates an earlier pattern (${key})`);
    seen.add(key);
  }
  assert.equal(seen.size, 26);
});

test('a lowercase letter encodes without a capital-sign cell', () => {
  const cells = encodeText('a');
  assert.equal(cells.length, 1);
  assert.equal(cells[0].sourceChar, 'a');
});

test('an uppercase letter is preceded by a capital-sign cell (dot 6)', () => {
  const cells = encodeText('A');
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[0].dots, [6]);
  assert.equal(cells[1].sourceChar, 'a');
});

test('a run of digits is preceded by a single number-sign cell, not one per digit', () => {
  const cells = encodeText('123');
  assert.equal(cells.length, 4); // one number-sign + three digit cells
  assert.deepEqual(cells[0].dots, [3, 4, 5, 6]);
  assert.equal(cells[1].sourceChar, '1');
  assert.equal(cells[2].sourceChar, '2');
  assert.equal(cells[3].sourceChar, '3');
});

test('a new number-sign is inserted again after a non-digit interrupts a digit run', () => {
  const cells = encodeText('1a2');
  // number-sign, '1', 'a', number-sign, '2'
  assert.equal(cells.length, 5);
  assert.deepEqual(cells[0].dots, [3, 4, 5, 6]);
  assert.equal(cells[2].sourceChar, 'a');
  assert.deepEqual(cells[3].dots, [3, 4, 5, 6]);
});

test('digits 1-9 and 0 reuse the a-j letter patterns in that order', () => {
  const oneCell = encodeText('1')[1];
  const aCell = encodeText('a')[0];
  assert.deepEqual(oneCell.dots, aCell.dots);

  const zeroCell = encodeText('0')[1];
  const jCell = encodeText('j')[0];
  assert.deepEqual(zeroCell.dots, jCell.dots);
});

test('a space encodes as a blank cell (no dots)', () => {
  const cells = encodeText('a b');
  assert.deepEqual(cells[1].dots, []);
});

test('supported punctuation encodes to its own distinct dot pattern', () => {
  const comma = encodeText(',')[0];
  const period = encodeText('.')[0];
  assert.notDeepEqual(comma.dots, period.dots);
  assert.deepEqual(comma.dots, [2]);
  assert.deepEqual(period.dots, [2, 5, 6]);
});

test('encode/decode round-trips plain lowercase text exactly', () => {
  const text = 'the quick brown fox';
  assert.equal(decodeBrailleString(encodeToBrailleString(text)), text);
});

test('encode/decode round-trips capitalized words exactly', () => {
  const text = 'Hello World';
  assert.equal(decodeBrailleString(encodeToBrailleString(text)), text);
});

test('encode/decode round-trips a mix of letters, digits and punctuation exactly', () => {
  const text = "Hello, World! 123";
  assert.equal(decodeBrailleString(encodeToBrailleString(text)), text);
});

test('encode/decode round-trips multiple separate digit runs correctly', () => {
  const text = 'room 12 and room 45';
  assert.equal(decodeBrailleString(encodeToBrailleString(text)), text);
});

test('decodeBrailleString maps an unrecognized dot pattern to a question mark rather than throwing', () => {
  // Dots [1,2,3,4,5,6] (all six dots) isn't assigned to any letter/punctuation/sign in this table.
  const fullCell = dotsToChar([1, 2, 3, 4, 5, 6]);
  assert.equal(decodeBrailleString(fullCell), '?');
});

test('encodeState/decodeState round-trip both the text and the mode', () => {
  const state = { text: 'Hello', mode: 'toBraille' };
  assert.deepEqual(decodeState(encodeState(state), state), state);

  const state2 = { text: encodeToBrailleString('Hello'), mode: 'toText' };
  assert.deepEqual(decodeState(encodeState(state2), state2), state2);
});

test('a link captured while in "Braille to Text" mode restores that same mode on a fresh load, not the default mode', () => {
  // Regression test: the mode was originally not part of the shareable state at all, so a link
  // captured in toText mode would reopen in the default toBraille mode with the Braille string
  // sitting in the wrong-direction input, producing garbage output instead of the original text.
  const brailleInput = encodeToBrailleString('Hello, World! 123');
  const capturedState = { text: brailleInput, mode: 'toText' };
  const params = encodeState(capturedState);

  const fallback = { text: '', mode: 'toBraille' }; // the app's actual default on a fresh load
  const restored = decodeState(params, fallback);

  assert.equal(restored.mode, 'toText');
  assert.equal(restored.text, brailleInput);
  assert.equal(decodeBrailleString(restored.text), 'Hello, World! 123');
});
