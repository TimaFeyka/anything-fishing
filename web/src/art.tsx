/**
 * Вся графика игры генерируется кодом: SVG-шаблоны + палитра + узор + эффекты.
 * Никаких фотографий и растровых картинок — только векторные формы и градиенты.
 */
import React from 'react';

export type ArtKind =
  | 'fish' | 'fishlong' | 'fishflat' | 'fishround' | 'jelly' | 'serpent' | 'kraken' | 'turtle' | 'ghost'
  | 'bottle' | 'can' | 'boot' | 'tire' | 'phone' | 'headphones' | 'watch' | 'gamepad' | 'console' | 'tv'
  | 'pc' | 'bike' | 'suitcase' | 'vending' | 'washer' | 'microwave' | 'toaster' | 'vacuum' | 'guitar'
  | 'umbrella' | 'pot' | 'shovel' | 'canister' | 'plate' | 'key' | 'coin' | 'ingot' | 'gem' | 'pearl'
  | 'crown' | 'mask' | 'chest' | 'map' | 'relic' | 'part' | 'chain' | 'cup' | 'casket' | 'drone' | 'robot'
  | 'camera' | 'engine' | 'propeller' | 'sonar' | 'device' | 'battery' | 'satellite' | 'blackbox'
  | 'container' | 'crystal' | 'orb' | 'portalpart' | 'rod' | 'sphere' | 'disk' | 'liquid' | 'echo'
  | 'safe' | 'anchor' | 'shipwreck' | 'wreckpart' | 'statue' | 'ark' | 'heart' | 'voidkey';

interface Props {
  kind: ArtKind | string;
  pal?: [string, string] | string[];
  pat?: string;
  size?: number;
  mutation?: string;
  rarityColor?: string;
  className?: string;
  title?: string;
}

const EYE = (x: number, y: number, r = 3.6) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#f7fbff" />
    <circle cx={x + 0.8} cy={y} r={r * 0.5} fill="#0b1016" />
  </g>
);

/** Силуэт предмета. Координаты в системе 0..100. */
function Shape({ kind, p, a, pat }: { kind: string; p: string; a: string; pat: string }) {
  const s = { stroke: a, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'fish':
      return (<g>
        <path d="M18 50 C30 32 62 30 78 46 C70 62 34 66 18 50 Z" fill={p} {...s} />
        <path d="M78 46 L94 32 L92 48 L94 64 Z" fill={a} opacity={0.85} />
        <path d="M44 33 L52 22 L60 34" fill={a} opacity={0.6} />
        {EYE(30, 46, 3.2)}
      </g>);
    case 'fishlong':
      return (<g>
        <path d="M10 52 C28 42 62 40 82 48 C86 56 82 60 74 62 C52 68 24 66 10 52 Z" fill={p} {...s} />
        <path d="M82 48 L97 40 L95 50 L97 62 Z" fill={a} />
        <path d="M30 44 L34 40 M40 42 L44 38 M50 41 L54 37" stroke={a} strokeWidth={1.4} />
        {EYE(20, 50, 3)}
      </g>);
    case 'fishflat':
      return (<g>
        <path d="M14 52 C30 16 66 14 84 48 C66 82 30 82 14 52 Z" fill={p} {...s} />
        <path d="M14 52 L4 42 L6 54 L4 66 Z" fill={a} />
        <path d="M40 26 C52 44 52 60 40 78" stroke={a} strokeWidth={1.2} fill="none" opacity={0.7} />
        {EYE(66, 44, 3.2)}
      </g>);
    case 'fishround':
      return (<g>
        <ellipse cx="50" cy="52" rx="30" ry="26" fill={p} {...s} />
        <path d="M78 52 L96 38 L94 54 L96 68 Z" fill={a} />
        <path d="M50 26 L58 15 L64 28" fill={a} opacity={0.7} />
        {EYE(35, 46, 3.6)}
      </g>);
    case 'jelly':
      return (<g>
        <path d="M22 48 C22 24 78 24 78 48 C70 54 30 54 22 48 Z" fill={p} {...s} />
        <path d="M28 50 C30 66 24 76 30 88 M42 52 C44 68 38 78 44 90 M58 52 C60 68 54 78 60 90 M72 50 C74 66 68 76 74 88" stroke={a} strokeWidth={2} fill="none" opacity={0.8} />
        {EYE(40, 40, 2.6)}
      </g>);
    case 'serpent':
      return (<g>
        <path d="M8 70 C24 78 30 46 46 50 C62 54 60 86 78 76 C86 71 90 60 94 52" stroke={p} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M8 70 C24 78 30 46 46 50 C62 54 60 86 78 76 C86 71 90 60 94 52" stroke={a} strokeWidth={2} fill="none" opacity={0.6} />
        <path d="M88 50 L97 42 L95 53" fill={a} />
        {EYE(90, 47, 2.6)}
      </g>);
    case 'kraken':
      return (<g>
        <ellipse cx="50" cy="34" rx="21" ry="18" fill={p} {...s} />
        <path d="M32 46 C26 66 18 74 24 88 M42 50 C40 70 34 80 40 92 M58 50 C60 70 66 80 60 92 M68 46 C74 66 82 74 76 88" stroke={a} strokeWidth={5} fill="none" strokeLinecap="round" />
        {EYE(42, 32, 4)}
        {EYE(58, 32, 4)}
      </g>);
    case 'turtle':
      return (<g>
        <ellipse cx="50" cy="54" rx="28" ry="20" fill={p} {...s} />
        <path d="M50 36 L50 72 M30 42 L70 66 M70 42 L30 66" stroke={a} strokeWidth={1.3} opacity={0.7} />
        <path d="M78 56 C88 54 92 62 88 68" fill={a} stroke={a} strokeWidth={3} />
        <circle cx="86" cy="58" r="1.6" fill="#0b1016" />
        <path d="M22 62 C14 70 22 76 30 72" fill={a} />
      </g>);
    case 'ghost':
      return (<g opacity={0.85}>
        <path d="M18 52 C28 30 66 28 80 46 C74 60 40 66 18 52 Z" fill={p} opacity={0.55} {...s} />
        <path d="M20 56 C30 72 44 60 54 72 C64 60 74 72 80 58" stroke={a} strokeWidth={2} fill="none" opacity={0.7} />
        {EYE(32, 46, 3)}
      </g>);
    case 'bottle':
      return (<g>
        <path d="M42 8 L58 8 L58 24 C70 30 72 40 72 62 C72 84 64 92 50 92 C36 92 28 84 28 62 C28 40 30 30 42 24 Z" fill={p} {...s} opacity={pat === 'glass' ? 0.6 : 1} />
        <rect x="40" y="4" width="20" height="6" rx="2" fill={a} />
        <rect x="30" y="60" width="40" height="18" rx="3" fill={a} opacity={0.35} />
      </g>);
    case 'can':
      return (<g>
        <rect x="30" y="18" width="40" height="66" rx="6" fill={p} {...s} />
        <ellipse cx="50" cy="18" rx="20" ry="6" fill={a} opacity={0.7} />
        <path d="M30 38 H70" stroke={a} strokeWidth={1.4} opacity={0.6} />
      </g>);
    case 'boot':
      return (<g>
        <path d="M34 12 L60 12 L62 52 C62 60 82 62 88 74 C92 84 84 90 72 90 L36 90 C30 90 28 84 30 76 Z" fill={p} {...s} />
        <path d="M32 84 H88" stroke={a} strokeWidth={4} opacity={0.8} />
      </g>);
    case 'tire':
      return (<g>
        <circle cx="50" cy="50" r="36" fill={p} stroke={a} strokeWidth={2} />
        <circle cx="50" cy="50" r="16" fill="#0b1016" opacity={0.7} />
        <circle cx="50" cy="50" r="36" fill="none" stroke={a} strokeWidth={5} strokeDasharray="6 7" opacity={0.55} />
      </g>);
    case 'phone':
      return (<g>
        <rect x="32" y="10" width="36" height="80" rx="8" fill={p} {...s} />
        <rect x="37" y="20" width="26" height="30" rx="3" fill={a} opacity={0.8} />
        <circle cx="50" cy="62" r="8" fill={a} opacity={0.5} />
      </g>);
    case 'headphones':
      return (<g>
        <path d="M22 62 C22 30 78 30 78 62" stroke={p} strokeWidth={9} fill="none" />
        <rect x="12" y="56" width="20" height="30" rx="8" fill={a} {...s} />
        <rect x="68" y="56" width="20" height="30" rx="8" fill={a} {...s} />
      </g>);
    case 'watch':
      return (<g>
        <rect x="42" y="6" width="16" height="24" rx="4" fill={p} opacity={0.8} />
        <rect x="42" y="70" width="16" height="24" rx="4" fill={p} opacity={0.8} />
        <circle cx="50" cy="50" r="24" fill={p} {...s} />
        <circle cx="50" cy="50" r="18" fill="#0d141b" />
        <path d="M50 50 L50 38 M50 50 L60 55" stroke={a} strokeWidth={2.4} />
      </g>);
    case 'gamepad':
      return (<g>
        <path d="M18 42 C24 30 76 30 82 42 C92 58 84 78 72 74 C64 71 60 64 50 64 C40 64 36 71 28 74 C16 78 8 58 18 42 Z" fill={p} {...s} />
        <rect x="26" y="48" width="12" height="4" rx="2" fill={a} />
        <rect x="30" y="44" width="4" height="12" rx="2" fill={a} />
        <circle cx="68" cy="48" r="3.4" fill={a} />
        <circle cx="76" cy="56" r="3.4" fill={a} opacity={0.7} />
      </g>);
    case 'console':
      return (<g>
        <rect x="16" y="30" width="68" height="42" rx="6" fill={p} {...s} />
        <rect x="26" y="40" width="30" height="8" rx="4" fill={a} opacity={0.8} />
        <circle cx="68" cy="60" r="5" fill={a} />
        <rect x="40" y="72" width="20" height="12" rx="3" fill={a} opacity={0.5} />
      </g>);
    case 'tv':
      return (<g>
        <rect x="14" y="24" width="72" height="52" rx="8" fill={p} {...s} />
        <rect x="22" y="32" width="56" height="36" rx="4" fill={a} opacity={0.65} />
        <path d="M30 46 L44 56 L58 40 L70 58" stroke="#eaf6ff" strokeWidth={1.6} fill="none" opacity={0.7} />
        <path d="M38 76 L30 90 M62 76 L70 90" stroke={p} strokeWidth={4} />
      </g>);
    case 'pc':
      return (<g>
        <rect x="10" y="26" width="52" height="38" rx="4" fill={p} {...s} />
        <rect x="15" y="31" width="42" height="28" rx="2" fill={a} opacity={0.6} />
        <rect x="66" y="20" width="24" height="60" rx="4" fill={p} {...s} />
        <path d="M72 30 H84 M72 38 H84" stroke={a} strokeWidth={2} opacity={0.7} />
        <circle cx="78" cy="68" r="3" fill={a} />
      </g>);
    case 'bike':
      return (<g>
        <circle cx="24" cy="66" r="18" fill="none" stroke={p} strokeWidth={4} />
        <circle cx="76" cy="66" r="18" fill="none" stroke={p} strokeWidth={4} />
        <path d="M24 66 L48 40 L76 66 M48 40 L42 66 L62 66" stroke={a} strokeWidth={3} fill="none" />
        <path d="M40 34 H56" stroke={a} strokeWidth={3} />
      </g>);
    case 'suitcase':
      return (<g>
        <rect x="14" y="34" width="72" height="48" rx="8" fill={p} {...s} />
        <path d="M38 34 V24 H62 V34" stroke={a} strokeWidth={4} fill="none" />
        <rect x="44" y="52" width="12" height="10" rx="2" fill={a} />
      </g>);
    case 'vending':
      return (<g>
        <rect x="22" y="6" width="56" height="88" rx="6" fill={p} {...s} />
        <rect x="30" y="14" width="26" height="52" rx="3" fill={a} opacity={0.6} />
        <rect x="62" y="20" width="10" height="8" rx="2" fill={a} />
        <rect x="30" y="74" width="40" height="10" rx="3" fill={a} opacity={0.4} />
      </g>);
    case 'washer':
      return (<g>
        <rect x="16" y="14" width="68" height="76" rx="8" fill={p} {...s} />
        <circle cx="50" cy="56" r="22" fill="#0d141b" stroke={a} strokeWidth={2} />
        <circle cx="50" cy="56" r="14" fill={a} opacity={0.35} />
        <path d="M28 24 H72" stroke={a} strokeWidth={2} opacity={0.6} />
      </g>);
    case 'microwave':
      return (<g>
        <rect x="12" y="28" width="76" height="46" rx="6" fill={p} {...s} />
        <rect x="18" y="34" width="46" height="34" rx="3" fill={a} opacity={0.6} />
        <rect x="70" y="36" width="12" height="30" rx="3" fill={a} opacity={0.35} />
      </g>);
    case 'toaster':
      return (<g>
        <path d="M20 40 H80 C84 40 86 46 82 50 L78 78 C77 84 72 88 66 88 H34 C28 88 23 84 22 78 L18 50 C14 46 16 40 20 40 Z" fill={p} {...s} />
        <rect x="30" y="34" width="16" height="8" rx="3" fill="#0d141b" />
        <rect x="54" y="34" width="16" height="8" rx="3" fill="#0d141b" />
        <rect x="72" y="58" width="6" height="14" rx="3" fill={a} />
      </g>);
    case 'vacuum':
      return (<g>
        <ellipse cx="48" cy="66" rx="30" ry="22" fill={p} {...s} />
        <path d="M26 50 C22 30 40 20 52 24 C68 28 70 44 74 56" stroke={a} strokeWidth={5} fill="none" />
        <circle cx="48" cy="66" r="8" fill={a} opacity={0.5} />
      </g>);
    case 'guitar':
      return (<g>
        <ellipse cx="44" cy="66" rx="22" ry="20" fill={p} {...s} />
        <ellipse cx="50" cy="44" rx="14" ry="12" fill={p} {...s} />
        <circle cx="46" cy="62" r="7" fill="#0d141b" opacity={0.6} />
        <rect x="50" y="10" width="7" height="34" rx="3" fill={a} transform="rotate(12 53 27)" />
      </g>);
    case 'umbrella':
      return (<g>
        <path d="M8 48 C14 22 86 22 92 48 C74 40 62 44 50 40 C38 44 26 40 8 48 Z" fill={p} {...s} />
        <path d="M50 44 V82 C50 90 60 90 60 84" stroke={a} strokeWidth={3} fill="none" />
      </g>);
    case 'pot':
      return (<g>
        <path d="M22 34 H78 L74 76 C73 84 66 88 58 88 H42 C34 88 27 84 26 76 Z" fill={p} {...s} />
        <path d="M14 40 H22 M78 40 H86" stroke={a} strokeWidth={5} />
        <ellipse cx="50" cy="34" rx="28" ry="6" fill={a} opacity={0.5} />
      </g>);
    case 'shovel':
      return (<g transform="rotate(-24 50 50)">
        <rect x="45" y="8" width="10" height="52" rx="3" fill={p} {...s} />
        <path d="M32 56 H68 L62 84 C60 90 52 92 50 92 C48 92 40 90 38 84 Z" fill={a} {...s} />
        <path d="M40 8 H60" stroke={a} strokeWidth={6} />
      </g>);
    case 'canister':
      return (<g>
        <rect x="26" y="20" width="48" height="70" rx="8" fill={p} {...s} />
        <rect x="52" y="10" width="12" height="12" rx="3" fill={a} />
        <path d="M40 34 C40 44 60 44 60 34" stroke={a} strokeWidth={3} fill="none" />
        <path d="M34 62 H66" stroke={a} strokeWidth={2} opacity={0.5} />
      </g>);
    case 'plate':
      return (<g>
        <rect x="10" y="30" width="80" height="40" rx="6" fill={p} {...s} />
        <text x="50" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill={a} fontFamily="monospace">AK·77</text>
      </g>);
    case 'key':
      return (<g>
        <circle cx="30" cy="34" r="16" fill="none" stroke={p} strokeWidth={6} />
        <circle cx="30" cy="34" r="5" fill={a} />
        <path d="M40 46 L78 84 M66 72 L76 62 M72 78 L80 70" stroke={p} strokeWidth={7} strokeLinecap="round" />
      </g>);
    case 'coin':
      return (<g>
        <circle cx="50" cy="50" r="34" fill={p} {...s} />
        <circle cx="50" cy="50" r="26" fill="none" stroke={a} strokeWidth={2.4} opacity={0.8} />
        <path d="M50 30 L56 44 L71 44 L59 53 L64 68 L50 58 L36 68 L41 53 L29 44 L44 44 Z" fill={a} opacity={0.85} />
      </g>);
    case 'ingot':
      return (<g>
        <path d="M22 66 L30 34 H70 L78 66 Z" fill={p} {...s} />
        <path d="M30 34 L36 20 H64 L70 34" fill={a} opacity={0.65} stroke={a} strokeWidth={1.5} />
        <path d="M34 50 H66" stroke={a} strokeWidth={2} opacity={0.5} />
      </g>);
    case 'gem':
      return (<g>
        <path d="M50 8 L82 38 L50 92 L18 38 Z" fill={p} {...s} />
        <path d="M18 38 H82 M50 8 L36 38 L50 92 M50 8 L64 38 L50 92" stroke={a} strokeWidth={1.6} fill="none" opacity={0.85} />
      </g>);
    case 'pearl':
    case 'sphere':
      return (<g>
        <circle cx="50" cy="50" r="30" fill={p} {...s} />
        <circle cx="40" cy="40" r="9" fill="#ffffff" opacity={0.7} />
        <circle cx="62" cy="62" r="4" fill={a} opacity={0.6} />
      </g>);
    case 'crown':
      return (<g>
        <path d="M18 68 L14 30 L34 46 L50 20 L66 46 L86 30 L82 68 Z" fill={p} {...s} />
        <rect x="18" y="68" width="64" height="14" rx="4" fill={a} />
        <circle cx="50" cy="32" r="4" fill="#ff5f6d" />
        <circle cx="30" cy="44" r="3" fill="#57a8ff" />
        <circle cx="70" cy="44" r="3" fill="#5fd68a" />
      </g>);
    case 'mask':
      return (<g>
        <path d="M50 12 C74 12 84 28 82 52 C80 76 66 90 50 90 C34 90 20 76 18 52 C16 28 26 12 50 12 Z" fill={p} {...s} />
        <path d="M30 40 C36 32 44 32 48 40 C42 46 34 46 30 40 Z" fill="#0d141b" />
        <path d="M70 40 C64 32 56 32 52 40 C58 46 66 46 70 40 Z" fill="#0d141b" />
        <path d="M38 66 C44 72 56 72 62 66" stroke={a} strokeWidth={2.4} fill="none" />
      </g>);
    case 'chest':
      return (<g>
        <rect x="14" y="44" width="72" height="42" rx="6" fill={p} {...s} />
        <path d="M14 48 C14 26 86 26 86 48 Z" fill={a} opacity={0.8} stroke={a} strokeWidth={1.6} />
        <rect x="42" y="52" width="16" height="18" rx="3" fill="#0d141b" stroke={a} strokeWidth={1.6} />
        <circle cx="50" cy="60" r="2.4" fill={a} />
      </g>);
    case 'casket':
      return (<g>
        <rect x="20" y="42" width="60" height="34" rx="6" fill={p} {...s} />
        <path d="M20 46 C20 30 80 30 80 46 Z" fill={a} opacity={0.7} stroke={a} strokeWidth={1.5} />
        <rect x="44" y="50" width="12" height="14" rx="2" fill="#0d141b" />
      </g>);
    case 'map':
      return (<g>
        <path d="M12 26 L36 18 L64 28 L88 20 L88 76 L64 84 L36 74 L12 82 Z" fill={p} {...s} />
        <path d="M36 18 V74 M64 28 V84" stroke={a} strokeWidth={1.4} opacity={0.6} />
        <path d="M22 60 C34 46 44 66 58 52" stroke="#e0572a" strokeWidth={2} fill="none" strokeDasharray="4 3" />
        <path d="M68 62 L74 68 M74 62 L68 68" stroke="#e0572a" strokeWidth={2.4} />
      </g>);
    case 'relic':
      return (<g>
        <path d="M38 84 L44 24 H56 L62 84 Z" fill={p} {...s} />
        <path d="M44 24 L50 10 L56 24" fill={a} />
        <circle cx="50" cy="42" r="5" fill={a} opacity={0.9} />
        <path d="M46 58 H54 M46 68 H54" stroke={a} strokeWidth={2} />
      </g>);
    case 'part':
      return (<g>
        <circle cx="50" cy="50" r="24" fill="none" stroke={p} strokeWidth={12} />
        <path d="M50 18 V8 M50 92 V82 M18 50 H8 M92 50 H82 M27 27 L20 20 M73 73 L80 80 M73 27 L80 20 M27 73 L20 80" stroke={p} strokeWidth={8} strokeLinecap="round" />
        <circle cx="50" cy="50" r="9" fill={a} />
      </g>);
    case 'chain':
      return (<g>
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={16 + i * 22} cy={i % 2 ? 60 : 42} rx="13" ry="9" fill="none" stroke={p} strokeWidth={6} />
        ))}
      </g>);
    case 'cup':
      return (<g>
        <path d="M30 22 H70 L64 56 C62 64 56 68 50 68 C44 68 38 64 36 56 Z" fill={p} {...s} />
        <path d="M50 68 V84 M36 88 H64" stroke={a} strokeWidth={5} strokeLinecap="round" />
        <ellipse cx="50" cy="22" rx="20" ry="5" fill={a} opacity={0.6} />
      </g>);
    case 'drone':
      return (<g>
        <rect x="34" y="40" width="32" height="20" rx="6" fill={p} {...s} />
        <path d="M34 44 L16 30 M66 44 L84 30 M34 56 L16 70 M66 56 L84 70" stroke={a} strokeWidth={3} />
        {[[16, 26], [84, 26], [16, 74], [84, 74]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill="none" stroke={a} strokeWidth={3} />)}
        <circle cx="50" cy="50" r="5" fill={a} />
      </g>);
    case 'robot':
      return (<g>
        <rect x="30" y="26" width="40" height="34" rx="8" fill={p} {...s} />
        <circle cx="42" cy="42" r="4" fill={a} />
        <circle cx="58" cy="42" r="4" fill={a} />
        <rect x="42" y="50" width="16" height="4" rx="2" fill={a} opacity={0.7} />
        <path d="M30 40 L16 56 M70 40 L84 56" stroke={a} strokeWidth={5} strokeLinecap="round" />
        <path d="M40 60 V78 H60 V60" fill={p} stroke={a} strokeWidth={1.6} />
      </g>);
    case 'camera':
      return (<g>
        <rect x="14" y="32" width="72" height="44" rx="6" fill={p} {...s} />
        <circle cx="50" cy="54" r="15" fill="#0d141b" stroke={a} strokeWidth={2} />
        <circle cx="50" cy="54" r="6" fill={a} opacity={0.5} />
        <rect x="20" y="24" width="18" height="10" rx="3" fill={a} />
      </g>);
    case 'engine':
      return (<g>
        <rect x="18" y="38" width="56" height="34" rx="5" fill={p} {...s} />
        <path d="M74 46 H88 M74 62 H88" stroke={a} strokeWidth={5} />
        <path d="M26 38 V26 M40 38 V22 M54 38 V30" stroke={a} strokeWidth={4} />
        <circle cx="32" cy="72" r="7" fill={a} opacity={0.6} />
      </g>);
    case 'propeller':
      return (<g>
        <circle cx="50" cy="50" r="9" fill={a} />
        <path d="M50 41 C40 20 24 16 20 30 C17 42 34 46 50 50 Z" fill={p} {...s} />
        <path d="M59 50 C80 40 84 24 70 20 C58 17 54 34 50 50 Z" fill={p} {...s} />
        <path d="M50 59 C60 80 76 84 80 70 C83 58 66 54 50 50 Z" fill={p} {...s} />
      </g>);
    case 'sonar':
      return (<g>
        <rect x="16" y="20" width="68" height="52" rx="8" fill="#0d141b" stroke={p} strokeWidth={2.5} />
        <path d="M50 46 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" fill={a} opacity={0.4} />
        <path d="M38 34 C26 46 26 46 38 58 M62 34 C74 46 74 46 62 58" stroke={a} strokeWidth={2} fill="none" opacity={0.8} />
        <path d="M50 72 V84 M34 88 H66" stroke={p} strokeWidth={4} />
      </g>);
    case 'device':
      return (<g>
        <rect x="24" y="34" width="52" height="46" rx="8" fill={p} {...s} />
        <circle cx="38" cy="50" r="4" fill={a} />
        <circle cx="52" cy="50" r="4" fill={a} opacity={0.7} />
        <path d="M50 34 V16 M40 16 H60" stroke={a} strokeWidth={3} />
        <path d="M34 66 H66" stroke={a} strokeWidth={2} opacity={0.6} />
      </g>);
    case 'battery':
      return (<g>
        <rect x="30" y="22" width="40" height="64" rx="6" fill={p} {...s} />
        <rect x="42" y="12" width="16" height="10" rx="3" fill={a} />
        <path d="M40 34 H60 M40 46 H60 M40 58 H60" stroke={a} strokeWidth={4} opacity={0.8} />
      </g>);
    case 'satellite':
      return (<g>
        <rect x="40" y="34" width="20" height="32" rx="4" fill={p} {...s} />
        <rect x="6" y="40" width="30" height="20" rx="3" fill={a} opacity={0.85} />
        <rect x="64" y="40" width="30" height="20" rx="3" fill={a} opacity={0.85} />
        <path d="M50 34 V18 M42 18 H58" stroke={a} strokeWidth={3} />
        <path d="M6 50 H0 M94 50 H100" stroke={a} strokeWidth={2} opacity={0.6} />
      </g>);
    case 'blackbox':
      return (<g>
        <rect x="16" y="30" width="68" height="42" rx="6" fill={p} {...s} />
        <path d="M16 44 H84 M16 58 H84" stroke={a} strokeWidth={3} opacity={0.6} />
        <circle cx="26" cy="66" r="4" fill={a} />
      </g>);
    case 'container':
      return (<g>
        <rect x="26" y="24" width="48" height="66" rx="10" fill={p} {...s} />
        <ellipse cx="50" cy="24" rx="24" ry="7" fill={a} opacity={0.65} />
        <circle cx="50" cy="60" r="13" fill="#0d141b" stroke={a} strokeWidth={2} />
        <path d="M50 54 V66 M44 60 H56" stroke={a} strokeWidth={2.4} />
      </g>);
    case 'crystal':
      return (<g>
        <path d="M50 8 L66 44 L50 92 L34 44 Z" fill={p} {...s} />
        <path d="M34 44 H66 M50 8 V92" stroke={a} strokeWidth={1.4} opacity={0.8} />
        <path d="M18 62 L26 44 L34 62 L26 84 Z" fill={a} opacity={0.7} />
        <path d="M68 66 L76 50 L82 66 L76 86 Z" fill={a} opacity={0.55} />
      </g>);
    case 'orb':
      return (<g>
        <circle cx="50" cy="50" r="32" fill={p} stroke={a} strokeWidth={1.6} />
        <circle cx="50" cy="50" r="22" fill="none" stroke={a} strokeWidth={1.2} opacity={0.6} />
        <circle cx="50" cy="50" r="12" fill={a} opacity={0.55} />
        <circle cx="42" cy="40" r="4" fill="#ffffff" opacity={0.8} />
      </g>);
    case 'portalpart':
      return (<g>
        <path d="M20 50 C20 30 80 30 80 50" stroke={p} strokeWidth={8} fill="none" />
        <path d="M32 50 C32 38 68 38 68 50" stroke={a} strokeWidth={5} fill="none" opacity={0.85} />
        <path d="M44 50 C44 44 56 44 56 50" stroke={p} strokeWidth={3} fill="none" />
        <circle cx="50" cy="70" r="10" fill={a} opacity={0.35} />
      </g>);
    case 'rod':
      return (<g transform="rotate(28 50 50)">
        <rect x="46" y="6" width="8" height="70" rx="4" fill={p} {...s} />
        <circle cx="50" cy="80" r="10" fill={a} opacity={0.8} />
        <path d="M50 16 V76" stroke={a} strokeWidth={2} opacity={0.8} />
      </g>);
    case 'disk':
      return (<g>
        <circle cx="50" cy="50" r="32" fill={p} {...s} />
        <circle cx="50" cy="50" r="24" fill="none" stroke={a} strokeWidth={1.4} opacity={0.7} />
        <path d="M50 26 L58 44 L76 44 L62 56 L66 74 L50 62 L34 74 L38 56 L24 44 L42 44 Z" fill="none" stroke={a} strokeWidth={1.6} opacity={0.9} />
        <circle cx="50" cy="50" r="6" fill={a} opacity={0.6} />
      </g>);
    case 'liquid':
      return (<g>
        <path d="M38 10 H62 V26 C72 32 74 42 74 62 C74 84 64 92 50 92 C36 92 26 84 26 62 C26 42 28 32 38 26 Z" fill="none" stroke={p} strokeWidth={2.4} />
        <path d="M28 56 C36 50 44 62 52 56 C60 50 68 60 73 56 L73 64 C73 84 64 90 50 90 C36 90 27 84 27 64 Z" fill={a} opacity={0.85} />
        <circle cx="44" cy="70" r="3.4" fill="#ffffff" opacity={0.7} />
      </g>);
    case 'echo':
      return (<g>
        <ellipse cx="50" cy="56" rx="26" ry="22" fill={p} {...s} />
        <path d="M22 44 C14 34 14 30 20 24 M78 44 C86 34 86 30 80 24" stroke={a} strokeWidth={2.4} fill="none" opacity={0.8} />
        <circle cx="42" cy="52" r="3" fill={a} opacity={0.8} />
      </g>);
    case 'safe':
      return (<g>
        <rect x="12" y="16" width="76" height="68" rx="8" fill={p} {...s} />
        <rect x="20" y="24" width="60" height="52" rx="6" fill="none" stroke={a} strokeWidth={2} opacity={0.7} />
        <circle cx="50" cy="50" r="14" fill="none" stroke={a} strokeWidth={3} />
        <path d="M50 36 V30 M50 70 V64 M36 50 H30 M70 50 H64" stroke={a} strokeWidth={3} />
        <circle cx="50" cy="50" r="4" fill={a} />
        <rect x="76" y="42" width="8" height="16" rx="3" fill={a} />
      </g>);
    case 'anchor':
      return (<g>
        <circle cx="50" cy="18" r="9" fill="none" stroke={p} strokeWidth={6} />
        <path d="M50 27 V74" stroke={p} strokeWidth={8} strokeLinecap="round" />
        <path d="M30 38 H70" stroke={p} strokeWidth={7} strokeLinecap="round" />
        <path d="M20 60 C22 82 40 88 50 88 C60 88 78 82 80 60" stroke={p} strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>);
    case 'shipwreck':
      return (<g>
        <path d="M6 62 C24 82 76 82 94 62 L86 76 C66 92 34 92 14 76 Z" fill={p} {...s} />
        <path d="M50 62 V14" stroke={a} strokeWidth={4} />
        <path d="M50 20 L76 34 L50 46 Z" fill={a} opacity={0.75} />
        <path d="M18 58 L30 46 M70 44 L82 56" stroke={a} strokeWidth={2} opacity={0.6} />
      </g>);
    case 'wreckpart':
      return (<g>
        <path d="M8 56 L44 30 L92 40 L88 66 L46 78 Z" fill={p} {...s} />
        <path d="M20 54 L40 42 M52 42 L80 48" stroke={a} strokeWidth={2} opacity={0.7} />
        <circle cx="34" cy="60" r="5" fill="#0d141b" opacity={0.6} />
      </g>);
    case 'statue':
      return (<g>
        <path d="M50 8 C58 8 64 14 64 22 C64 30 58 34 50 34 C42 34 36 30 36 22 C36 14 42 8 50 8 Z" fill={p} {...s} />
        <path d="M34 40 L44 36 H56 L66 40 L60 62 L62 90 H38 L40 62 Z" fill={p} {...s} />
        <path d="M44 44 V58 M56 44 V58" stroke={a} strokeWidth={1.4} opacity={0.6} />
      </g>);
    case 'ark':
      return (<g>
        <path d="M6 58 C10 74 20 84 50 84 C80 84 90 74 94 58 Z" fill={p} {...s} />
        <rect x="28" y="34" width="44" height="24" rx="4" fill={a} opacity={0.85} stroke={a} strokeWidth={1.6} />
        <path d="M50 34 V12 M38 22 H62" stroke={a} strokeWidth={3} />
        <path d="M14 58 H86" stroke={a} strokeWidth={2} opacity={0.5} />
      </g>);
    case 'heart':
      return (<g>
        <path d="M50 88 C20 66 12 46 24 32 C36 18 50 30 50 40 C50 30 64 18 76 32 C88 46 80 66 50 88 Z" fill={p} {...s} />
        <path d="M50 44 L44 54 L56 60 L48 72" stroke={a} strokeWidth={2.4} fill="none" />
        <circle cx="50" cy="50" r="26" fill="none" stroke={a} strokeWidth={1.2} opacity={0.4} />
      </g>);
    case 'voidkey':
      return (<g>
        <circle cx="32" cy="34" r="20" fill="#07070d" stroke={p} strokeWidth={4} />
        <circle cx="32" cy="34" r="9" fill={a} opacity={0.6} />
        <path d="M44 48 L84 88 M70 74 L80 64 M76 80 L84 72" stroke={p} strokeWidth={8} strokeLinecap="round" />
      </g>);
    default:
      return (<g>
        <rect x="18" y="18" width="64" height="64" rx="10" fill={p} {...s} />
        <path d="M30 50 H70 M50 30 V70" stroke={a} strokeWidth={3} opacity={0.7} />
      </g>);
  }
}

/** Узор/материал поверх силуэта. */
function Pattern({ pat, a, id }: { pat: string; a: string; id: string }) {
  switch (pat) {
    case 'spots':
      return (<g opacity={0.55}>{[[34, 40], [50, 34], [62, 46], [40, 58], [56, 60], [70, 54]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.4} fill={a} />)}</g>);
    case 'stripes':
      return (<g opacity={0.5}>{[30, 40, 50, 60, 70].map((x) => <path key={x} d={`M${x} 34 C${x - 6} 46 ${x - 6} 56 ${x} 68`} stroke={a} strokeWidth={2.6} fill="none" />)}</g>);
    case 'scale':
      return (<g opacity={0.45}>{[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => <path key={`${r}-${c}`} d={`M${22 + c * 14 + (r % 2) * 7} ${34 + r * 12} a7 7 0 0 1 14 0`} stroke={a} strokeWidth={1.4} fill="none" />))}</g>);
    case 'rust':
      return (<g opacity={0.5}><circle cx="34" cy="42" r="7" fill={a} /><circle cx="62" cy="60" r="9" fill={a} /><circle cx="52" cy="36" r="5" fill={a} /></g>);
    case 'circuit':
      return (<g opacity={0.6} stroke={a} strokeWidth={1.6} fill="none"><path d="M24 40 H44 V60 H72" /><path d="M30 66 H50 V30 H74" /><circle cx="44" cy="60" r="2.6" fill={a} /></g>);
    case 'rune':
      return (<g opacity={0.75} stroke={a} strokeWidth={2} fill="none">
        <circle cx="50" cy="50" r="20" />
        <path d="M50 34 L62 56 L38 56 Z" />
        <path d="M50 30 V70 M32 50 H68" opacity={0.5} />
      </g>);
    case 'glass':
      return (<g opacity={0.35}><path d={`M${26} ${24} L${74} ${76}`} stroke="#ffffff" strokeWidth={7} /></g>);
    case 'glow':
      return (<>
        <circle cx="50" cy="50" r="30" fill={`url(#glow-${id})`} />
        <circle cx="50" cy="50" r="34" fill={`url(#halo-${id})`} />
      </>);
    case 'gold':
      return (<>
        <rect x="0" y="0" width="100" height="100" fill={`url(#gold-${id})`} opacity={0.55} />
        <path d="M26 26 L32 20 M74 30 L80 24 M60 74 L66 68" stroke="#fff2b0" strokeWidth={2.4} opacity={0.9} />
      </>);
    default:
      return null;
  }
}

export function ItemArt({ kind, pal = ['#8fa3b0', '#33414d'], pat = 'none', size = 96, mutation = 'none', rarityColor, className, title }: Props) {
  const p = pal[0] ?? '#8fa3b0';
  const a = pal[1] ?? '#33414d';
  const uid = React.useId().replace(/[:]/g, '');
  const ghost = mutation === 'ghostly';
  const golden = mutation === 'golden';
  const scale = mutation === 'giant' ? 1.12 : 1;
  const filter = rarityColor ? `drop-shadow(0 0 6px ${rarityColor}aa)` : undefined;
  return (
    <svg viewBox="-8 -8 116 116" width={size} height={size} className={className} style={{ filter, overflow: 'visible' }} role="img" aria-label={title ?? kind}>
      <defs>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor={a} stopOpacity="0.55" />
          <stop offset="100%" stopColor={a} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`halo-${uid}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="45%" stopColor="#ffb038" />
          <stop offset="100%" stopColor="#d98324" />
        </linearGradient>
      </defs>
      <g transform={`translate(50 50) scale(${scale}) translate(-50 -50)`} opacity={ghost ? 0.72 : 1} style={ghost ? { filter: 'drop-shadow(0 0 8px #bfeaff)' } : undefined}>
        <Shape kind={kind} p={golden ? '#e8b43c' : p} a={golden ? '#fff2b0' : a} pat={pat} />
        <Pattern pat={pat} a={golden ? '#fff2b0' : a} id={uid} />
        {mutation === 'mutant' && <path d="M18 60 C34 40 52 74 66 50 C74 38 84 44 88 52" stroke="#7aff8a" strokeWidth={2} fill="none" opacity={0.55} />}
        {mutation === 'pristine' && <path d="M30 26 C46 16 64 22 74 34" stroke="#ffffff" strokeWidth={2.4} fill="none" opacity={0.55} />}
        {ghost && <path d="M12 74 C28 62 40 86 56 72 C68 62 80 78 92 68" stroke="#bfeaff" strokeWidth={2} fill="none" opacity={0.6} />}
        {golden && <path d="M30 30 L34 24 M68 34 L74 28 M58 70 L64 64" stroke="#fff2b0" strokeWidth={2} opacity={0.9} />}
      </g>
    </svg>
  );
}

/** Сцена: вода, берег, камыш, поплавок. Всё — процедурный SVG. */
export function WaterScene({ shore, location = 'lake', floatX = 50, floatY = 62, shadow = 0, glow = 0, ripples = 0, reel = false, className }: {
  shore?: boolean; location?: string; floatX?: number; floatY?: number; shadow?: number; glow?: number; ripples?: number; reel?: boolean; className?: string;
}) {
  const palettes: Record<string, [string, string, string]> = {
    lake: ['#0d2b23', '#12463a', '#2f7a63'],
    harbor: ['#101f2b', '#1b3a4d', '#3a6b8a'],
    ocean: ['#0a2b40', '#0f4560', '#2f8aa8'],
    ice: ['#16283a', '#2a4a63', '#7fb6d6'],
    abyss: ['#04070f', '#0a1220', '#244a6a'],
    sunken: ['#0a2626', '#123a3a', '#2f7a6a'],
    alien: ['#14092a', '#241145', '#7a3fd0'],
  };
  const [c1, c2, c3] = palettes[location] ?? palettes.lake;
  const uid = React.useId().replace(/[:]/g, '');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="60%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor="#a8fff0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a8fff0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#sky-${uid})`} />
      {/* луна/солнце */}
      <circle cx="78" cy="18" r="7" fill="#dff3ff" opacity={0.25} />
      {/* дальние холмы / город */}
      {location === 'sunken' ? (
        <g opacity={0.5}>{[14, 30, 46, 62, 78].map((x, i) => <rect key={x} x={x} y={44 - (i % 3) * 3} width="12" height={14 + (i % 3) * 3} fill="#06181a" />)}</g>
      ) : (
        <path d="M0 46 C18 38 34 44 50 40 C66 36 84 44 100 40 L100 60 L0 60 Z" fill="#050f14" opacity={0.55} />
      )}
      {/* вода */}
      <rect x="0" y="48" width="100" height="52" fill={c2} opacity={0.65} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M0 ${54 + i * 8} C18 ${50 + i * 8} 32 ${58 + i * 8} 50 ${54 + i * 8} C68 ${50 + i * 8} 82 ${58 + i * 8} 100 ${54 + i * 8}`}
          stroke="#bfe6ff" strokeWidth={0.5} fill="none" opacity={0.18 - i * 0.02} />
      ))}
      {/* камыш / берег */}
      {shore && (
        <g>
          <path d="M0 92 C20 84 40 96 60 88 C76 82 90 92 100 88 L100 100 L0 100 Z" fill="#1a2a1e" />
          <path d="M6 84 C10 68 8 60 14 50 M16 86 C20 70 18 62 24 54 M26 88 C30 74 28 66 34 58" stroke="#22331f" strokeWidth={1.6} fill="none" />
        </g>
      )}
      {/* круги на воде от следов */}
      {ripples > 0 && [0, 1, 2].map((i) => (
        <ellipse key={i} cx={floatX} cy={floatY + 6} rx={6 + i * 6 + ripples * 2} ry={2 + i * 2} fill="none" stroke="#dff3ff" strokeWidth={0.5} opacity={0.35 - i * 0.08} />
      ))}
      {/* тень под водой */}
      {shadow > 0 && (
        <ellipse cx={floatX} cy={floatY + 14} rx={6 + shadow * 26} ry={(3 + shadow * 9) * 0.7} fill="#04121a" opacity={0.5} />
      )}
      {glow > 0 && <circle cx={floatX} cy={floatY + 8} r={10 + glow * 26} fill={`url(#glow-${uid})`} opacity={0.7} />}
      {/* поплавок и леска */}
      <g transform={reel ? 'rotate(4 50 62)' : undefined}>
        <path d={`M4 12 C24 18 38 40 ${floatX} ${floatY - 6}`} stroke="#dff3ff" strokeWidth={0.6} fill="none" opacity={0.5} />
        <ellipse cx={floatX} cy={floatY} rx={2.4} ry={3.4} fill={c3} />
        <rect x={floatX - 0.6} y={floatY - 8} width="1.2" height="6" fill="#e0572a" />
      </g>
    </svg>
  );
}

/** Простая иконка для навигации/магазина — тоже векторная. */
export function Glyph({ name, size = 22, color = 'currentColor', style }: { name: string; size?: number; color?: string; style?: React.CSSProperties }) {
  const paths: Record<string, string> = {
    fish: 'M3 12c4-6 12-6 16-1-4 5-12 5-16 1Zm16-1 4-3v6l-4-3Z M7 11a1 1 0 1 0 2 0a1 1 0 0 0-2 0',
    map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v14M15 6v14',
    book: 'M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Zm16 0h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4V4Z',
    cart: 'M3 4h2l2.5 11h10L20 7H6M9 20a1 1 0 1 0 2 0a1 1 0 0 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 0 0-2 0',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
    home: 'M4 11 12 4l8 7v9H4v-9Zm5 9v-5h6v5',
    hammer: 'M14 4l6 6-3 3-6-6 3-3Zm-3 5-7 7 3 3 7-7',
    flask: 'M9 3h6v5l4 9a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3l4-9V3Zm-2 9h10',
    shop: 'M4 9h16v11H4V9Zm2-5h12l2 5H4l2-5Zm4 9v7m4-7v7',
    trophy: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 1H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3M10 16h4v4h-4z',
    star: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8L12 3Z',
    warn: 'M12 3l9 17H3L12 3Zm0 6v5m0 3v1',
    back: 'M15 5l-7 7 7 7',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 13l4 4L19 7',
    coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10m3-7c0-1.7-1.3-2-3-2s-3 .3-3 2 1.3 2 3 2 3 .3 3 2-1.3 2-3 2-3-.3-3-2',
    share: 'M12 3v12M8 7l4-4 4 4M5 15v5h14v-5',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={paths[name] ?? paths.star} />
    </svg>
  );
}
