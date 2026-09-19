import { useEffect, useState } from 'react';

export type HolidayMap = Record<string, string>;

export interface HolidayRegion {
  id: string;
  name: string;
}

export const HOLIDAY_NONE = 'none';
export const DEFAULT_HOLIDAY_REGION = 'japanese';

export const HOLIDAY_REGIONS: HolidayRegion[] = [
  { id: 'japanese', name: '日本 (Japan)' },
  { id: 'usa', name: 'アメリカ (USA)' },
  { id: 'south_korea', name: '韓国 (South Korea)' },
  { id: 'th', name: 'タイ (Thailand)' },
  { id: 'uk', name: 'イギリス (UK)' },
  { id: 'germany', name: 'ドイツ (Germany)' },
  { id: 'france', name: 'フランス (France)' },
  { id: 'australia', name: 'オーストラリア (Australia)' },
  { id: 'china', name: '中国 (China)' },
  { id: 'taiwan', name: '台湾 (Taiwan)' },
];

const CACHE_PREFIX = 'focusweeks_holidays_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  baseYear: number;
  data: HolidayMap;
}

function readCache(region: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + region);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

function isFresh(entry: CacheEntry): boolean {
  return (
    Date.now() - entry.fetchedAt < CACHE_TTL_MS &&
    entry.baseYear === new Date().getFullYear()
  );
}

async function fetchFromApi(region: string): Promise<HolidayMap> {
  const year = new Date().getFullYear();
  const qs = new URLSearchParams({
    region,
    from: `${year - 1}-01-01`,
    to: `${year + 1}-12-31`,
  });
  const res = await fetch(`/api/holidays?${qs}`);
  if (!res.ok) throw new Error(`holidays api ${res.status}`);

  const json = (await res.json()) as { holidays: { date: string; name: string }[] };
  const map: HolidayMap = {};
  for (const h of json.holidays) {
    map[h.date] = map[h.date] && map[h.date] !== h.name ? `${map[h.date]} / ${h.name}` : h.name;
  }
  return map;
}

export async function getHolidays(region: string): Promise<HolidayMap> {
  if (region === HOLIDAY_NONE) return {};

  const cached = readCache(region);
  if (cached && isFresh(cached)) return cached.data;

  try {
    const data = await fetchFromApi(region);
    try {
      const entry: CacheEntry = { fetchedAt: Date.now(), baseYear: new Date().getFullYear(), data };
      localStorage.setItem(CACHE_PREFIX + region, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
    return data;
  } catch (e) {
    console.error('祝日の取得に失敗しました:', e);
    return cached?.data ?? {};
  }
}

export function useHolidays(region: string = DEFAULT_HOLIDAY_REGION): HolidayMap {
  const [holidays, setHolidays] = useState<HolidayMap>(() =>
    region === HOLIDAY_NONE ? {} : readCache(region)?.data ?? {}
  );

  useEffect(() => {
    let cancelled = false;
    setHolidays(region === HOLIDAY_NONE ? {} : readCache(region)?.data ?? {});
    getHolidays(region).then((map) => {
      if (!cancelled) setHolidays(map);
    });
    return () => {
      cancelled = true;
    };
  }, [region]);

  return holidays;
}
