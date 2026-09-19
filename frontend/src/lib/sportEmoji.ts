// No real product photography for this demo — a simple emoji on the
// light-brown thumbnail background stands in for one (specs/frontend-spec.md
// Layout Reference describes the thumbnail treatment, not a specific image source).
const EMOJI_BY_KEYWORD: Array<[RegExp, string]> = [
  [/football/i, '⚽'],
  [/basketball/i, '🏀'],
  [/tennis/i, '🎾'],
  [/badminton/i, '🏸'],
  [/cricket/i, '🏏'],
];

export function getSportEmoji(itemName: string): string {
  const match = EMOJI_BY_KEYWORD.find(([pattern]) => pattern.test(itemName));
  return match ? match[1] : '🏅';
}
