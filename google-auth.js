// google-auth.js
// Google OAuth2 PKCE flow + Google Calendar API v3 integration

import { StorageManager } from './storage.js';
import { ICalParser } from './ical-parser.js';

const GOOGLE_AUTH_KEY = 'focusweeks_google_auth';
const GOOGLE_CALENDARS_KEY = 'focusweeks_google_calendars';

// ★ ここにご自身のクライアントIDを入力してください
// Google Cloud Console > APIとサービス > 認証情報 > OAuth 2.0 クライアントID
const CLIENT_ID = '1005545288287-apf5ubci7csiqvr8g83sq2aurnh85ooi.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_LIST_API = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const EVENTS_API = (calId) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;

// ---------- PKCE helpers ----------
function generateRandomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').substring(0, length);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function createPKCE() {
  const verifier = generateRandomString(64);
  const hashed = await sha256(verifier);
  const challenge = base64URLEncode(hashed);
  return { verifier, challenge };
}

// ---------- Public API ----------
export const GoogleAuth = {

  // ログイン済みかどうか
  isLoggedIn() {
    const auth = this._getAuth();
    if (!auth || !auth.access_token) return false;
    // トークン有効期限チェック
    if (auth.expires_at && Date.now() > auth.expires_at) return false;
    return true;
  },

  getAccountInfo() {
    return this._getAuth();
  },

  // OAuth認証開始（PKCE）
  async startLogin() {
    if (CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
      alert(
        'Google連携を使うには、google-auth.js の CLIENT_ID を\nGoogle Cloud Console で取得したクライアントIDに書き換えてください。\n\n設定手順:\n1. console.cloud.google.com にアクセス\n2. 新規プロジェクト作成\n3. 「APIとサービス」>「ライブラリ」> Google Calendar API を有効化\n4. 「認証情報」> 「OAuth 2.0クライアントID」作成\n   種類: ウェブアプリケーション\n   リダイレクトURI: ' + REDIRECT_URI
      );
      return;
    }

    const { verifier, challenge } = await createPKCE();
    const state = generateRandomString(16);

    // PKCEの検証子とstateをsessionStorageに一時保存
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent select_account',
    });

    window.location.href = `${AUTH_ENDPOINT}?${params}`;
  },

  // リダイレクト後のコードをトークンと交換
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.warn('Google OAuthエラー:', error);
      this._clearCallbackParams();
      return false;
    }

    if (!code) return false;

    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      console.error('OAuth state mismatch');
      this._clearCallbackParams();
      return false;
    }

    const verifier = sessionStorage.getItem('pkce_verifier');

    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      });

      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error('トークン取得失敗');

      const tokenData = await res.json();

      // ユーザー情報取得
      const userInfo = await this._fetchUserInfo(tokenData.access_token);

      const auth = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in - 60) * 1000,
        email: userInfo?.email || '',
        name: userInfo?.name || '',
        picture: userInfo?.picture || '',
      };

      localStorage.setItem(GOOGLE_AUTH_KEY, JSON.stringify(auth));
      sessionStorage.removeItem('pkce_verifier');
      sessionStorage.removeItem('oauth_state');
      this._clearCallbackParams();

      return true;
    } catch (err) {
      console.error('Token exchange error:', err);
      this._clearCallbackParams();
      return false;
    }
  },

  async _fetchUserInfo(accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  },

  // ログアウト
  logout() {
    localStorage.removeItem(GOOGLE_AUTH_KEY);
    localStorage.removeItem(GOOGLE_CALENDARS_KEY);
  },

  // Googleカレンダー一覧取得
  async fetchCalendarList() {
    const token = this._getAccessToken();
    if (!token) return [];

    const res = await fetch(CALENDAR_LIST_API, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  },

  // 指定したGoogleカレンダーの予定を取得してローカルに保存
  async syncCalendar(gcal, onProgress) {
    const token = this._getAccessToken();
    if (!token) throw new Error('ログインが必要です');

    const now = new Date();
    const timeMin = new Date(now.getFullYear() - 1, 0, 1).toISOString();
    const timeMax = new Date(now.getFullYear() + 2, 11, 31).toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });

    const res = await fetch(`${EVENTS_API(gcal.id)}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`カレンダー取得失敗: ${gcal.summary}`);
    const data = await res.json();
    const gEvents = data.items || [];

    // Googleイベント → ローカル形式に変換
    const calId = 'gcal_' + gcal.id.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const events = gEvents.map((g) => this._convertGEvent(g, calId)).filter(Boolean);

    // 既存のローカルイベントからこのカレンダーのものを削除して再登録
    let allEvents = StorageManager.getEvents().filter((e) => e.calendarId !== calId);
    allEvents = [...allEvents, ...events];
    StorageManager.saveEvents(allEvents);

    // カレンダー情報も保存
    const calendars = StorageManager.getCalendars();
    const exists = calendars.find((c) => c.id === calId);
    if (!exists) {
      const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ff7043', '#9c27b0'];
      const randomColor = gcal.backgroundColor || colors[Math.floor(Math.random() * colors.length)];
      calendars.push({
        id: calId,
        name: gcal.summary,
        color: randomColor,
        visible: true,
        order: calendars.length,
        url: '',
        googleCalId: gcal.id,
      });
      StorageManager.saveCalendars(calendars);
    }

    return events.length;
  },

  _convertGEvent(g, calId) {
    if (!g.summary) return null;
    const start = g.start?.dateTime || g.start?.date;
    const end = g.end?.dateTime || g.end?.date;
    if (!start) return null;

    return {
      id: 'gcal_evt_' + g.id,
      calendarId: calId,
      title: g.summary,
      start,
      end: end || start,
      allDay: !g.start?.dateTime,
      description: g.description || '',
      location: g.location || '',
    };
  },

  _getAccessToken() {
    const auth = this._getAuth();
    if (!auth) return null;
    if (auth.expires_at && Date.now() > auth.expires_at) return null;
    return auth.access_token;
  },

  _getAuth() {
    try {
      return JSON.parse(localStorage.getItem(GOOGLE_AUTH_KEY) || 'null');
    } catch {
      return null;
    }
  },

  _clearCallbackParams() {
    // URLからOAuthパラメータを除去
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());
  },
};
