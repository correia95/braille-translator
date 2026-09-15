# Braille Translator

Convert English text to Grade 1 (uncontracted) Braille and back, using the
standard Unicode Braille Patterns block.

- Letters a-z, digits 0-9 (with a number-sign prefix), capital letters (with
  a capital-sign prefix), space, and basic punctuation
- "Swap" button uses the current output as the new input and flips direction
- Alphabet reference chart
- Shareable link (`?t=&m=`), encoding both the text *and* the active
  direction; nothing is uploaded, works offline

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/braille.test.mjs
```

The engine (`encodeText`, `decodeBrailleString`, `dotsToChar`) is in
`src/braille.ts`. Dot patterns convert directly to Unicode codepoints via
their bitmask offset from U+2800, cross-checked against well-known reference
codepoints (`a`=U+2801, `b`=U+2803, `z`=U+2835) and a uniqueness check across
all 26 letters (Braille assigns every letter a distinct pattern by design,
so any accidental duplicate in the table would be a transcription bug). 17
Node tests in `src/braille.test.mjs`, including a regression test for a bug
caught before shipping: the shareable link originally encoded only the text,
not which direction (text→Braille or Braille→text) was active, so a link
copied while in Braille→text mode reopened in the default text→Braille mode
with the Braille string in the wrong-direction input, producing a row of
blank cells instead of the original text.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://braille-translator.correia95.workers.dev/>.
