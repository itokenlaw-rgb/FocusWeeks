import React, { useState, useEffect } from 'react';
import { 
  initOAuthClient, 
  requestAccessToken, 
  requestAccessTokenSilent, // ★追加：サイレント再取得関数をインポート
  listEvents, 
  createEvent, 
  deleteEvent, 
  updateEvent 
} from './utils/googleCalendar';
import { CalendarEvent } from './types/calendar';
import MonthView from './components/MonthView';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import EventModal from './components/EventModal';
import Sidebar from './components/Sidebar';
import { Calendar, ChevronLeft, ChevronRight, Menu, Plus, RefreshCw, Sun, Moon, LogOut } from 'lucide-react';

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

  // ★追加：裏で自動ログインのチェックを行っている最中かどうかを管理するステート
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // ★追加：サイレント認証のために、ユーザーのメールアドレスを保存・管理するステート
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('google_user_email');
  });

  // --- その他のUI・データ関連のステート ---
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // ★追加：トークンやユーザー情報を受信したときの共通保存ロジック
  const handleTokenReceived = (token: string, expiresAt: number) => {
    setGoogleToken(token);
    localStorage.setItem('google_access_token', token);
    localStorage.setItem('google_token_expires_at', expiresAt.toString());

    // 本来はここでGoogleの `userinfo` API等を叩いて実際のメアドを取得するのが理想ですが、
    // 方法1の段階では、ログインが成功したという実績作りのため仮の識別子（または固定値）を保存します。
    // ※Googleカレンダーの予定が取得できるアカウントであれば、実用上動作します。
    if (!localStorage.getItem('google_user_email')) {
      // 実際の運用では認証後に取得したユーザーのメールアドレスをセットしてください
      const detectedEmail = 'default_user@gmail.com'; 
      setUserEmail(detectedEmail);
      localStorage.setItem('google_user_email', detectedEmail);
    }
    
    setIsCheckingAuth(false);
  };

  // --- テーマ切り替えの初期化 ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // --- 認証・クライアント初期化のuseEffect ---
  useEffect(() => {
    // 1. 通常のOAuthクライアントの初期化（手動ログイン用）
    initOAuthClient((token, expiresAt) => {
      console.log('手動ログインに成功しました');
      handleTokenReceived(token, expiresAt);
    });

    // 2. 自動ログイン（サイレント再取得）のチェックロジック
    if (googleToken) {
      // すでに有効なトークンがlocalStorageにあれば、チェックをスキップして即表示
      setIsCheckingAuth(false);
    } else if (userEmail) {
      // トークンは切れているが、過去にログインしたメールアドレスの記録がある場合
      console.log('トークン期限