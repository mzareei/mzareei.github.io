// Secret racer names for the end-of-class piñata race. Each attempt gets one:
// "{Animal} {Adjective}", plus the animal's emoji. Spanish on purpose, in both
// UI languages — the names are part of the fun.
//
// Every adjective is gender-invariant (Turbo, Veloz, Zen, …) so any pairing is
// correct Spanish. That fact is hand-curated and reviewed, not machine-checked:
// do not add adjectives that decline (rápido/rápida would break half the pairs).
//
// Pure on purpose: no Deno, no database. The frontend repo's verifier imports
// and executes this file.

export const ANIMALS: Array<{ name: string; emoji: string }> = [
  { name: "Ajolote", emoji: "🦎" }, { name: "Tlacuache", emoji: "🦝" },
  { name: "Jaguar", emoji: "🐆" }, { name: "Tecolote", emoji: "🦉" },
  { name: "Coyote", emoji: "🐺" }, { name: "Guacamaya", emoji: "🦜" },
  { name: "Tortuga", emoji: "🐢" }, { name: "Abeja", emoji: "🐝" },
  { name: "Águila", emoji: "🦅" }, { name: "Rana", emoji: "🐸" },
  { name: "Pulpo", emoji: "🐙" }, { name: "Flamenco", emoji: "🦩" },
  { name: "Caballo", emoji: "🐴" }, { name: "Alacrán", emoji: "🦂" },
  { name: "Delfín", emoji: "🐬" }, { name: "Ardilla", emoji: "🐿️" },
  { name: "Perezoso", emoji: "🦥" }, { name: "Erizo", emoji: "🦔" },
  { name: "Oso", emoji: "🐻" }, { name: "Zorro", emoji: "🦊" },
  { name: "Pingüino", emoji: "🐧" }, { name: "Pavorreal", emoji: "🦚" },
  { name: "Cocodrilo", emoji: "🐊" }, { name: "Mariposa", emoji: "🦋" },
  { name: "Borrego", emoji: "🐏" }, { name: "Conejo", emoji: "🐰" },
  { name: "Mono", emoji: "🐵" }, { name: "Tiburón", emoji: "🦈" },
  { name: "Ballena", emoji: "🐳" }, { name: "Llama", emoji: "🦙" },
  { name: "Cangrejo", emoji: "🦀" }, { name: "Caracol", emoji: "🐌" },
  { name: "Dinosaurio", emoji: "🦖" }, { name: "Dragón", emoji: "🐉" },
  { name: "Unicornio", emoji: "🦄" }
];

export const ADJECTIVES: string[] = [
  "Turbo", "Veloz", "Feroz", "Audaz", "Fugaz", "Sagaz", "Tenaz",
  "Picante", "Valiente", "Brillante", "Elegante", "Rebelde", "Salvaje",
  "Imparable", "Invencible", "Increíble", "Genial", "Fenomenal", "Radical",
  "Espacial", "Astral", "Digital", "Viral", "Ninja", "Zen",
  "Relámpago", "Fantasma", "Pirata", "Jedi", "Samurái"
];

/**
 * A random unused name, or null when every combination is taken (35 × 30 =
 * 1050 combinations, so a class never exhausts it; null is for correctness,
 * not for classrooms). `rng` exists so tests can seed it.
 */
export function pickRacerName(
  used: string[],
  rng: () => number = Math.random
): { name: string; emoji: string } | null {
  const taken = new Set(used);
  const free: Array<{ name: string; emoji: string }> = [];
  for (const animal of ANIMALS) {
    for (const adjective of ADJECTIVES) {
      const name = `${animal.name} ${adjective}`;
      if (!taken.has(name)) free.push({ name, emoji: animal.emoji });
    }
  }
  if (!free.length) return null;
  return free[Math.floor(rng() * free.length) % free.length];
}
