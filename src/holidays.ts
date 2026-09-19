// src/utils/holidays.ts
import { useEffect, useState } from 'react';

export type HolidayMap = Record<string, string>; // 'YYYY-MM-DD' → 祝日名

export interface HolidayRegion {
  id: string;    // Google祝日カレンダーIDの地域部分 (例: 'japanese' → ja.japanese.official#holiday@...)
  label: string; // 設定画面での表示名
}

export const HOLIDAY_NONE = 'none';
export const DEFAULT_HOLIDAY_REGION = 'japanese';

// id は Google の祝日カレンダーID（en.<id>.official#holiday@group.v.calendar.google.com）の <id> 部分。
// 他の国を足したいときは、下記の一覧から <id> をコピーして1行足すだけ。
// https://gist.github.com/dhoeric/76bd1c15168ee0ee61ad3bf1730dcb65
export const HOLIDAY_REGIONS: HolidayRegion[] = [
  { id: 'japanese', label: '日本' },
  // アジア
  { id: 'south_korea', label: '韓国' },
  { id: 'china', label: '中国' },
  { id: 'taiwan', label: '台湾' },
  { id: 'hong_kong', label: '香港' },
  { id: 'singapore', label: 'シンガポール' },
  { id: 'th', label: 'タイ' },
  { id: 'vietnamese', label: 'ベトナム' },
  { id: 'philippines', label: 'フィリピン' },
  { id: 'indonesian', label: 'インドネシア' },
  { id: 'malaysia', label: 'マレーシア' },
  { id: 'indian', label: 'インド' },
  // オセアニア
  { id: 'australian', label: 'オーストラリア' },
  { id: 'new_zealand', label: 'ニュージーランド' },
  // 北米・南米
  { id: 'usa', label: 'アメリカ' },
  { id: 'canadian', label: 'カナダ' },
  { id: 'mexican', label: 'メキシコ' },
  { id: 'brazilian', label: 'ブラジル' },
  // ヨーロッパ
  { id: 'uk', label: 'イギリス' },
  { id: 'irish', label: 'アイルランド' },
  { id: 'french', label: 'フランス' },
  { id: 'german', label: 'ドイツ' },
  { id: 'italian', label: 'イタリア' },
  { id: 'spain', label: 'スペイン' },
  { id: 'portuguese', label: 'ポルトガル' },
  { id: 'dutch', label: 'オランダ' },
  { id: 'ch', label: 'スイス' },
  { id: 'austrian', label: 'オーストリア' },
  { id: 'swedish', label: 'スウェーデン' },
  { id: 'norwegian', label: 'ノルウェー' },
  { id: 'danish', label: 'デンマーク' },
  { id: 'finnish', label: 'フィンランド' },
  { id: 'polish', label: 'ポーランド' },
  { id: 'russian', label: 'ロシア' },
  { id: 'turkish', label: 'トルコ' },
  // 中東・アフリカ
  { id: 'jewish', label: 'イスラエル' },
  { id: 'ae', label: 'アラブ首長国連邦' },
  { id: 'saudiarabian', label: 'サウジアラビア' },
  { id: 'eg', label: 'エジプト' },
  { id: 'sa', label: '南アフリカ' },
];

const CACHE_PREFIX = 'focusweeks_holidays_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

interface CacheEntry {
  fetchedAt: number;
  baseYear: number; // 取得時の「今年」。年が変わったら取り直す
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
  // 表示範囲は「今日の -12週 〜 +42週」程度なので、前年〜翌年の3年分を取得
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
    // 同じ日に複数ある場合は「 / 」でつなぐ
    map[h.date] = map[h.date] && map[h.date] !== h.name ? `${map[h.date]} / ${h.name}` : h.name;
  }
  return map;
}

/** キャッシュが新しければそれを、無ければAPIから取得。失敗時は古いキャッシュ→空の順にフォールバック */
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
      /* localStorage が満杯でも表示は続行 */
    }
    return data;
  } catch (e) {
    console.error('祝日の取得に失敗しました:', e);
    return cached?.data ?? {};
  }
}

/** 設定の地域に応じた祝日マップを返す React フック */
export function useHolidays(region: string): HolidayMap {
  const [holidays, setHolidays] = useState<HolidayMap>(() =>
    region === HOLIDAY_NONE ? {} : readCache(region)?.data ?? {}
  );

  useEffect(() => {
    let cancelled = false;
    // 地域を切り替えた直後に、前の国の祝日が残らないよう一旦キャッシュ or 空にする
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
