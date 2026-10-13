// lib/card-ranges.ts
//
// The Admin Lobby's physical ID cards and the numbers printed / barcoded on
// them. Each kind of card has its own block of numbers, so a number tells
// which kind of card it is:
//
//   Vendor (kuning, business area)   L1001 – L1208
//   Visitor                          L2001 – L2030
//   Affiliate Yazaki                 L4001 – L4030
//   Special Area                     L401  – L410
//   ID Photography                   L301  – L310
//
// The portal uses this to refuse a card of the wrong kind (a Visitor card
// handed out as a Vendor card would sit in the wrong column of "Kartu Sedang
// Digunakan") and to tell, from a scan alone, what a card is.
// Pos Security's cards are a separate set and are not listed here.
// Safe to import on the client and on the server.

export type LobbyCardKind = 'vendor' | 'visitor' | 'affiliate' | 'special_area' | 'photography'

export const LOBBY_CARD_RANGES: Record<LobbyCardKind, [from: number, to: number][]> = {
  vendor: [[1001, 1208]],
  visitor: [[2001, 2030]],
  affiliate: [[4001, 4030]],
  special_area: [[401, 410]],
  photography: [[301, 310]],
}

export const LOBBY_CARD_LABEL: Record<LobbyCardKind, string> = {
  vendor: 'Vendor', visitor: 'Visitor', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography',
}

/**
 * A card number as it is stored and compared: trimmed, and "l1001" / "L 1001"
 * written the one way the cards have it ("L1001"). Anything that is not an
 * L-number (Pos Security's cards, older free-form entries) is only trimmed.
 */
export function normalizeCardNo(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : ''
  const match = /^l\s*(\d{1,6})$/i.exec(text)
  return match ? `L${match[1]}` : text
}

/** Which kind of Lobby card a number is — null when it is not one of the Lobby's numbers. */
export function lobbyCardKind(cardNo: string): LobbyCardKind | null {
  const match = /^L(\d{1,6})$/.exec(normalizeCardNo(cardNo))
  if (!match) return null
  // "L0401" is not a card: the numbers have no leading zero
  if (match[1].startsWith('0')) return null
  const n = Number(match[1])
  for (const kind of Object.keys(LOBBY_CARD_RANGES) as LobbyCardKind[]) {
    if (LOBBY_CARD_RANGES[kind].some(([from, to]) => n >= from && n <= to)) return kind
  }
  return null
}

/** "L1001 – L1208" */
export function lobbyCardRangeText(kind: LobbyCardKind): string {
  return LOBBY_CARD_RANGES[kind].map(([from, to]) => `L${from} – L${to}`).join(', ')
}

/**
 * Why this number can't be used as a Lobby card of `kind` — null when it can.
 * strict: the number must be one of that kind's own (the Lobby's Vendor /
 * Visitor / Affiliate cards). Otherwise only a number that belongs to another
 * kind is refused (card numbers typed on a permit, which older entries wrote
 * freely).
 */
export function lobbyCardProblem(cardNo: string, kind: LobbyCardKind, strict = true): string | null {
  const no = normalizeCardNo(cardNo)
  const actual = lobbyCardKind(no)
  if (actual === kind) return null
  if (actual) return `Nomor ${no} adalah kartu ${LOBBY_CARD_LABEL[actual]}, bukan kartu ${LOBBY_CARD_LABEL[kind]}. Kartu ${LOBBY_CARD_LABEL[kind]} bernomor ${lobbyCardRangeText(kind)}.`
  return strict ? `Nomor ${no || '(kosong)'} bukan nomor kartu ${LOBBY_CARD_LABEL[kind]} Lobby. Kartu ${LOBBY_CARD_LABEL[kind]} bernomor ${lobbyCardRangeText(kind)}.` : null
}
