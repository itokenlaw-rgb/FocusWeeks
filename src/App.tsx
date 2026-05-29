import { useState, useEffect } from 'react';
import { 
  initOAuthClient, 
  requestAccessToken, 
  requestAccessTokenSilent, 
  fetchGoogleEvents
} from './utils/googleCalendar';
// TypeScriptの厳格な型インポートルールに対応
import type { CalendarEvent } from './utils/googleCalendar';

function App() {
  // --- 認証関連のステート ---
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    const token = localStorage.getItem('google_access_token');
    const expiresAt = localStorage.getItem('google_token_expires_at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      return token;
    }
    return null;
  });

  // 裏で自動ログインのチェックを行っている最中かどうかを管理するステート
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // サイレント認証のために、ユーザーのメールアドレスを保存・管理するステート
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('google_user_email');
  });

  // --- その他のUI・データ関連 of ステート ---
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // トークンやユーザー情報を受信したときの共通保存ロジック
  const handleTokenReceived = (token: string, expiresAt: number) => {
    setGoogleToken(token);
    localStorage.setItem('google_access_token', token);
    localStorage.setItem('google_token_expires_at', expiresAt.toString());

    if (!localStorage.getItem('google_user_email')) {
      const detectedEmail = "default_user@gmail.com";
      setUserEmail(detectedEmail);
      localStorage.setItem('google_user_email', detectedEmail);
    }
    
    setIsCheckingAuth(false);
  };

  // --- テーマ切り替えの初期化 ---
  useEffect(() => {
    const body = document.body;
    if (isDarkMode) {
      body.classList.add('theme-monochrome');
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.remove('theme-monochrome');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // --- 認証・クライアント初期化のuseEffect ---
  useEffect(() => {
    initOAuthClient((token, expiresAt) => {
      console.log('手動ログインに成功しました');
      handleTokenReceived(token, expiresAt);
    });

    if (googleToken) {
      setIsCheckingAuth(false);
    } else if (userEmail) {
      console.log('トークン期限切れのため、裏で自動再取得を試みます...');
      requestAccessTokenSilent(userEmail, (token, expiresAt) => {
        if (token && expiresAt) {
          console.log('自動ログインに成功しました');
          setGoogleToken(token);
          localStorage.setItem('google_access_token', token);
          localStorage.setItem('google_token_expires_at', expiresAt.toString());
          setIsCheckingAuth(false);
        } else {
          console.log('自動ログインに失敗しました');
          setIsCheckingAuth(false);
        }
      });
    } else {
      setIsCheckingAuth(false);
    }
  }, [googleToken, userEmail]);

  // --- トークンがある場合にイベント一覧を取得するuseEffect ---
  useEffect(() => {
    if (googleToken) {
      fetchEvents();
    }
  }, [googleToken, currentDate]);

  const fetchEvents = async () => {
    if (!googleToken) return;
    setIsLoading(true);
    try {
      const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();
      const fetchedEvents = await fetchGoogleEvents(googleToken, timeMin, timeMax);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      if ((error as any).message === 'UNAUTHORIZED') {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setGoogleToken(null);
    setUserEmail(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
    localStorage.removeItem('google_user_email');
    setEvents([]);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // --- レンダリング分岐 ---
  if (isCheckingAuth) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f5' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#71717a', fontWeight: 500 }}>同期情報を確認中...</p>
        </div>
      </div>
    );
  }

  if (!googleToken) {
    return (
      <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '32px', borderRadius: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Googleカレンダー連携</h1>
          <p style={{ color: '#71717a', marginBottom: '24px', fontSize: '14px' }}>
            サインインすることで、いつでも自動同期・スケジュール管理ができるようになります。
          </p>
          <button
            onClick={requestAccessToken}
            style={{ width: '100%', backgroundColor: '#27272a', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Googleアカウントでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="header-title-container">
            <span className="header-year">{currentDate.getFullYear()}年</span>
            <span className="header-month">{currentDate.getMonth() + 1}月</span>
          </div>
          <button className="header-focus-toggle-btn" onClick={prevMonth}>前月</button>
          <button className="header-focus-toggle-btn" onClick={nextMonth}>次月</button>
        </div>
        <div className="header-right">
          <button className="header-focus-toggle-btn" style={{ backgroundColor: '#b91c1c' }} onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="scroll-content" style={{ padding: '16px' }}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#71717a' }}>同期中...</p>
        ) : (
          <div className="month-container">
            <h3>予定一覧 ({events.length} 件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {events.map((event) => (
                <div key={event.id} className="panel-event-row" style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e4e4e7', background: '#fff' }}>
                  <div className="panel-event-title" style={{ fontWeight: 600 }}>{event.title}</div>
                  <div className="panel-event-time" style={{ fontSize: '12px', color: '#71717a' }}>
                    {event.start.substring(0, 16).replace('T', ' ')} 〜 {event.end.substring(0, 16).replace('T', ' ')}
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="panel-no-events-text">この期間に予定はありません。</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;