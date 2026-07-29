import { XMLParser } from "fast-xml-parser";

import { parseReleaseTitle, type ParsedTitle } from "./parse-title.ts";

export type NyaaFilterParams = {
  query: string;
  /** Nyaa category, e.g. "1_2" = Anime / English-translated */
  category: string;
  /** "0" none, "1" no remakes, "2" trusted only */
  filter: string;
};

export type NyaaRelease = ParsedTitle & {
  nyaaId: number;
  rawTitle: string;
  infoHash: string;
  magnetUri: string;
  sizeBytes: number | null;
  seeders: number | null;
  leechers: number | null;
  publishedAt: Date | null;
};

/** Public trackers Nyaa itself lists on its magnet links. */
const TRACKERS = [
  "http://nyaa.tracker.wf:7777/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce",
];

export function buildRssUrl({ query, category, filter }: NyaaFilterParams) {
  const url = new URL("https://nyaa.si/");
  url.searchParams.set("page", "rss");
  url.searchParams.set("q", query);
  url.searchParams.set("c", category);
  url.searchParams.set("f", filter);
  return url.toString();
}

export function buildMagnetUri(infoHash: string, displayName: string) {
  const params = new URLSearchParams();
  params.set("dn", displayName);
  const trackers = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}&${params.toString()}${trackers}`;
}

/** Nyaa reports sizes as human strings ("820.0 MiB", "1.5 GiB"). */
export function parseSizeToBytes(size: string | undefined): number | null {
  if (!size) return null;
  const match = size.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/i);
  if (!match) return null;

  const units: Record<string, number> = {
    b: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  };
  const multiplier = units[match[2].toLowerCase()];
  if (!multiplier) return null;

  return Math.round(Number(match[1]) * multiplier);
}

/** The guid is a permalink: https://nyaa.si/view/2138496 */
function parseNyaaId(guid: unknown): number | null {
  const text = typeof guid === "object" && guid !== null
    ? String((guid as { "#text"?: unknown })["#text"] ?? "")
    : String(guid ?? "");
  const match = text.match(/\/view\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

type RawItem = Record<string, unknown>;

export function parseRssFeed(xml: string): NyaaRelease[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Namespaced tags arrive as "nyaa:seeders"; keep them verbatim.
    removeNSPrefix: false,
  });

  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: RawItem | RawItem[] } };
  };

  const rawItems = doc.rss?.channel?.item;
  if (!rawItems) return [];

  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.flatMap((item): NyaaRelease[] => {
    const rawTitle = String(item.title ?? "").trim();
    const infoHash = String(item["nyaa:infoHash"] ?? "").trim();
    const nyaaId = parseNyaaId(item.guid);

    // Without an id or hash there's nothing stable to key on or link to.
    if (!rawTitle || !infoHash || nyaaId === null) return [];

    return [
      {
        nyaaId,
        rawTitle,
        infoHash,
        magnetUri: buildMagnetUri(infoHash, rawTitle),
        sizeBytes: parseSizeToBytes(
          item["nyaa:size"] === undefined ? undefined : String(item["nyaa:size"])
        ),
        seeders: toNumberOrNull(item["nyaa:seeders"]),
        leechers: toNumberOrNull(item["nyaa:leechers"]),
        publishedAt: toDateOrNull(item.pubDate),
        ...parseReleaseTitle(rawTitle),
      },
    ];
  });
}

export class NyaaFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NyaaFetchError";
  }
}

export async function fetchReleases(
  params: NyaaFilterParams,
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {}
): Promise<NyaaRelease[]> {
  const url = buildRssUrl(params);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "NekoStream/0.1 (self-hosted)" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (cause) {
    throw new NyaaFetchError("Could not reach nyaa.si.", { cause });
  }

  if (!response.ok) {
    throw new NyaaFetchError(
      `nyaa.si returned ${response.status} ${response.statusText}.`
    );
  }

  return parseRssFeed(await response.text());
}
