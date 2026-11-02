import React, { useState, useEffect } from 'react';

/**
 * CipherTypeSpecimen:
 * Clean, exact typography specimen card that dynamically encrypts and decrypts
 * between clean Latin glyphs/numbers and cryptographic cipher characters.
 */
export default function CipherTypeSpecimen({ className = '' }) {
  const originalLines = [
    'Aa Bb Cc Dd Ee Ff Gg',
    'Hh Ii Jj Kk Ll Mm Nn',
    'Oo Pp Qq Rr Ss Tt Uu',
    'Vv Ww Xx Yy Zz',
    '0123456789'
  ];

  const CIPHER_CHARS = '0123456789ABCDEF$#@%&*<>{}[]/?~ΔλΩΨ§‡±!XQZ';

  // State: 'plain', 'encrypting', 'encrypted', 'decrypting'
  const [phase, setPhase] = useState('plain');
  const [displayLines, setDisplayLines] = useState(originalLines);

  useEffect(() => {
    let timeoutId;

    const runCycle = () => {
      // 1. Plain text holds for 2.6s
      setPhase('plain');
      setDisplayLines(originalLines);

      timeoutId = setTimeout(() => {
        // 2. Encrypting: characters scramble progressively over 1.0s
        setPhase('encrypting');
        let step = 0;
        const totalSteps = 12;
        const encryptInterval = setInterval(() => {
          step++;
          setDisplayLines(
            originalLines.map((line) =>
              line
                .split('')
                .map((ch) => {
                  if (ch === ' ') return ' ';
                  if (Math.random() < step / totalSteps) {
                    return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                  }
                  return ch;
                })
                .join('')
            )
          );

          if (step >= totalSteps) {
            clearInterval(encryptInterval);
            // 3. Encrypted holds for 2.0s
            setPhase('encrypted');
            timeoutId = setTimeout(() => {
              // 4. Decrypting: resolves from left to right over 1.2s
              setPhase('decrypting');
              let decStep = 0;
              const decSteps = 16;
              const decryptInterval = setInterval(() => {
                decStep++;
                const ratio = decStep / decSteps;
                setDisplayLines(
                  originalLines.map((line) =>
                    line
                      .split('')
                      .map((ch, idx) => {
                        if (ch === ' ') return ' ';
                        if (idx / line.length <= ratio) {
                          return ch; // Decrypted
                        }
                        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                      })
                      .join('')
                  )
                );

                if (decStep >= decSteps) {
                  clearInterval(decryptInterval);
                  // Restart cycle
                  runCycle();
                }
              }, 65);
            }, 2000);
          }
        }, 70);
      }, 2600);
    };

    runCycle();

    return () => clearTimeout(timeoutId);
  }, []);

  // Click immediately scrambles or resets
  const handleClick = () => {
    if (phase === 'plain') {
      setPhase('encrypted');
      setDisplayLines(
        originalLines.map((line) =>
          line
            .split('')
            .map((ch) => (ch === ' ' ? ' ' : CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)]))
            .join('')
        )
      );
    } else {
      setPhase('plain');
      setDisplayLines(originalLines);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`w-full h-full flex flex-col justify-center cursor-pointer select-none font-['Pixelify_Sans'] ${className}`}
      title="Click to toggle cipher matrix"
    >
      <div className="text-[17px] sm:text-[18.5px] md:text-[19.5px] lg:text-[20.5px] font-extrabold leading-[1.34] tracking-[0.055em] transition-all duration-150 transform scale-x-[1.15] origin-left">
        {displayLines.slice(0, 4).map((line, idx) => (
          <p
            key={idx}
            className={`transition-colors duration-150 ${
              phase === 'encrypted'
                ? 'text-[#9BBFE0]'
                : phase === 'encrypting' || phase === 'decrypting'
                ? 'text-white'
                : 'text-white'
            }`}
          >
            {line}
          </p>
        ))}

        {/* Numbers Row */}
        <p
          className={`tracking-[0.12em] mt-1 transition-colors duration-150 ${
            phase === 'encrypted'
              ? 'text-[#9BBFE0]'
              : phase === 'encrypting' || phase === 'decrypting'
              ? 'text-white'
              : 'text-white'
          }`}
        >
          {displayLines[4]}
        </p>
      </div>
    </div>
  );
}
