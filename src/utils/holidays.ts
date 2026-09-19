import { useState, useEffect } from 'react';

export interface Holiday {
  date: string;
  name: string;
}

export interface HolidayRegion {
  id: string;
  name: string;
}

export const DEFAULT_HOLIDAY_REGION = 'japanese';
export const HOLIDAY_NONE = 'none';

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

export function useHolidays(region: string = DEFAULT_HOLIDAY_REGION, fromDate?: string, toDate?: string) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!region || region === HOLIDAY_NONE) {
      setHolidays([]);
      return;
    }

    const currentYear = new Date().getFullYear();
    const start = fromDate || `${currentYear - 1}-01-01`;
    const end = toDate || `${currentYear + 2}-12-31`;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/holidays?region=${encodeURIComponent(region)}&from=${start}&to=${end}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch holidays');
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.holidays) {
          setHolidays(data.holidays);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching holidays:', err);
          setError(err.message);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [region, fromDate, toDate]);

  return { holidays, loading, error };
}