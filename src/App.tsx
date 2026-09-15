import { useEffect, useMemo, useState } from 'react';
import { decodeBrailleString, decodeState, encodeState, encodeToBrailleString, supportedCharacters, type State } from './braille';

function defaultState(): State {
  return { text: 'Hello, World! 123', mode: 'toBraille' };
}

function readInitial(): State {
  try {
    return decodeState(new URLSearchParams(window.location.search), defaultState());
  } catch {
    return defaultState();
  }
}

const ALPHABET_ROWS: string[][] = [
  'abcdefghij'.split(''),
  'klmnopqrst'.split(''),
  'uvwxyz'.split(''),
];

export default function App() {
  const [state, setState] = useState<State>(readInitial);
  const [copied, setCopied] = useState(false);
  const { mode, text } = state;

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.search = encodeState(state).toString();
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
  }, [state]);

  const output = useMemo(() => {
    if (mode === 'toBraille') return encodeToBrailleString(text);
    return decodeBrailleString(text);
  }, [mode, text]);

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const setMode = (mode: State['mode']) => setState((s) => ({ ...s, mode }));
  const setText = (text: string) => setState((s) => ({ ...s, text }));

  const switchMode = () => {
    setState((s) => ({ text: output, mode: s.mode === 'toBraille' ? 'toText' : 'toBraille' }));
  };

  return (
    <div className="app">
      <header>
        <h1>Braille Translator</h1>
        <p className="tag">
          Convert English text to Grade 1 (uncontracted) Braille and back, using the standard
          Unicode Braille patterns. Everything runs in your browser.
        </p>
      </header>

      <div className="seg">
        <button className={mode === 'toBraille' ? 'on' : ''} onClick={() => setMode('toBraille')}>
          Text → Braille
        </button>
        <button className={mode === 'toText' ? 'on' : ''} onClick={() => setMode('toText')}>
          Braille → Text
        </button>
      </div>

      <label className="f">
        <span>{mode === 'toBraille' ? 'English text' : 'Braille'}</span>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'toBraille' ? 'Type text to convert…' : 'Paste Braille Unicode characters…'}
        />
      </label>

      <div className="output-row">
        <button className="swap" onClick={switchMode} title="Use the output as the new input, and switch direction">
          ⇅ Swap
        </button>
      </div>

      <label className="f">
        <span>{mode === 'toBraille' ? 'Braille' : 'English text'}</span>
        <div className={`output ${mode === 'toBraille' ? 'braille-text' : ''}`}>{output || <span className="muted">—</span>}</div>
      </label>

      <button className="share" onClick={copyOutput}>
        {copied ? 'Copied' : 'Copy output'}
      </button>

      <section className="reference">
        <h2>Alphabet reference</h2>
        <div className="ref-grid">
          {ALPHABET_ROWS.map((row, i) => (
            <div key={i} className="ref-row">
              {row.map((letter) => (
                <div key={letter} className="ref-cell">
                  <span className="ref-braille">{encodeToBrailleString(letter)}</span>
                  <span className="ref-letter">{letter}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="explainer">
        <h2>How this works</h2>
        <p>
          Each Braille character is one of the 64 possible dot combinations in a 2×3 cell,
          rendered using the Unicode Braille Patterns block. Letters a–z each get a unique
          pattern; digits 1–9 and 0 reuse the patterns for a–j, preceded by a "number sign" cell;
          a capital letter is preceded by a "capital sign" cell rather than having its own separate
          pattern — this matches standard Grade 1 (uncontracted) English Braille.
        </p>
        <h3>What's supported</h3>
        <p>Supported characters: {supportedCharacters()}.</p>
        <h3>Is anything sent to a server?</h3>
        <p>No. Every conversion happens in your browser.</p>
        <footer>Braille Translator · no sign-up · works offline once loaded</footer>
      </section>
    </div>
  );
}
