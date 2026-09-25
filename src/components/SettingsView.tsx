import React from 'react';
import { X } from 'lucide-react';
import { HOLIDAY_REGIONS, HOLIDAY_NONE } from '../utils/holidays';

// 1. Settings型を、3用と5用でそれぞれ before/after を持てるように拡張
interface Settings {
  textSize: 'small' | 'medium' | 'large';
  focusSize: 3 | 5;
  weekStart: 'monday' | 'sunday';
  themeColor: 'monochrome' | 'red' | 'blue' | 'yellow' | 'green';
  eventColor: 'default' | 'monochrome' | 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'pink' | 'orange' | 'teal';
  // それぞれ独立したオブジェクトとして管理
  focusSize3: { before: 0 | 1; after: 0 | 1 | 2 };
  focusSize5: { before: 0 | 1; after: 0 | 1 | 2 };
  useGoogleColors: boolean; // ★ 追加
  holidayRegion: string; // 祝日の地域（'none' で非表示）
  calendarRange: 'normal' | 'wide'; // 予定を読み込む期間（normal: 過去3ヶ月・未来6ヶ月／wide: 過去6ヶ月・未来12ヶ月）
}

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
  onClose: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  isLoggedIn,
  onLogin,
  onLogout,
}) => {

// ★ トグル切り替え用のハンドラーを追加
  const handleUseGoogleColorsChange = (checked: boolean) => {
    onUpdateSettings({ ...settings, useGoogleColors: checked });
  };

  // 予定の通知はGoogleカレンダー側に委ねるため、タップでGoogleカレンダーの
  // 通知設定ページを新しいタブで開く
  const openGoogleCalendarNotificationSettings = () => {
    window.open('https://calendar.google.com/calendar/r/settings/notifications', '_blank', 'noopener,noreferrer');
  };

  const handleTextSizeChange = (textSize: Settings['textSize']) => {
    onUpdateSettings({ ...settings, textSize });
  };

  const handleFocusSizeChange = (focusSize: Settings['focusSize']) => {
    onUpdateSettings({ ...settings, focusSize });
  };

  const handleWeekStartChange = (weekStart: Settings['weekStart']) => {
    onUpdateSettings({ ...settings, weekStart });
  };

  const handleHolidayRegionChange = (holidayRegion: string) => {
    onUpdateSettings({ ...settings, holidayRegion });
  };

  const handleCalendarRangeChange = (calendarRange: Settings['calendarRange']) => {
    onUpdateSettings({ ...settings, calendarRange });
  };

  const handleThemeColorChange = (themeColor: Settings['themeColor']) => {
    onUpdateSettings({ ...settings, themeColor });
  };

  const handleEventColorChange = (eventColor: Settings['eventColor']) => {
    onUpdateSettings({ ...settings, eventColor });
  };

// 2. 選択中のフォーカスサイズ（3または5）の値を書き換えるようにハンドラーを修正
  const handleFocusRangeChange = (type: 'before' | 'after', value: number) => {
    const nextSettings = { ...settings };
    const currentSizeKey = settings.focusSize === 3 ? 'focusSize3' : 'focusSize5';
    
    if (type === 'before') {
      nextSettings[currentSizeKey].before = value as 0 | 1;
    } else {
      nextSettings[currentSizeKey].after = value as 0 | 1 | 2;
    }

// 既存の合計3週間を超えない制限ロジックも、アクティブなサイズに合わせて適用
    const totalSelected = nextSettings[currentSizeKey].before + nextSettings[currentSizeKey].after;
    if (totalSelected > 3) {
      if (type === 'before') {
        nextSettings[currentSizeKey].after = 2;
      } else {
        nextSettings[currentSizeKey].before = 1;
      }
    }

    onUpdateSettings(nextSettings);
  };

// 現在選ばれているフォーカスサイズ（3か5）の設定値を参照しやすくする
  const currentRange = settings.focusSize === 3 ? settings.focusSize3 : settings.focusSize5;

  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* ヘッダー領域 */}
        <div className="fullscreen-header">
          <button onClick={onClose} className="icon-btn" aria-label="閉じる">
            <X size={24} />
          </button>
          <span className="fullscreen-title">設定</span>
          <div style={{ width: 40 }} />
        </div>

        {/* スクロール可能な設定項目エリア */}
        <div className="fullscreen-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* 予定の通知（Googleカレンダー側の通知設定を開く） */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>予定の通知</span>
            <div className="login-status-container" style={{ marginTop: 0 }}>
              {isLoggedIn ? (
                <>
                  <div className="login-status-text">通知はGoogleカレンダー側で設定します</div>
                  <div className="login-status-subtext">下のボタンからGoogleカレンダーの通知設定ページが開きます。通知のオン/オフやタイミングはそちらで設定してください。</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={openGoogleCalendarNotificationSettings}
                  >
                    Googleカレンダーの通知設定を開く
                  </button>
                </>
              ) : (
                <>
                  <div className="login-status-text">通知はGoogleカレンダー側で設定します</div>
                  <div className="login-status-subtext">Googleアカウントと連携すると、Googleカレンダーの通知設定を開けるようになります。</div>
                </>
              )}
            </div>
          </div>

          {/* 文字の大きさ */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="form-label" style={{ margin: 0 }}>文字の大きさ</span>
            <div style={{ display: 'inline-flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="textSize"
                  checked={settings.textSize === 'small'}
                  onChange={() => handleTextSizeChange('small')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                小
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="textSize"
                  checked={settings.textSize === 'medium'}
                  onChange={() => handleTextSizeChange('medium')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                中
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="textSize"
                  checked={settings.textSize === 'large'}
                  onChange={() => handleTextSizeChange('large')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                大
              </label>
            </div>
          </div>

          {/* フォーカスの大きさ */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="form-label" style={{ margin: 0 }}>フォーカスの大きさ</span>
            <div style={{ display: 'inline-flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="focusSize"
                  checked={settings.focusSize === 3}
                  onChange={() => handleFocusSizeChange(3)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                小
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="focusSize"
                  checked={settings.focusSize === 5}
                  onChange={() => handleFocusSizeChange(5)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                大
              </label>
            </div>
          </div>

{/* フォーカスの対象（ここを書き換え：現在選ばれているサイズ名を表示し、値を連動させる） */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 4 }}>
              フォーカスの対象
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', minWidth: '70px' }}>基準週より前</span>
                <div className="settings-option-list" style={{ flex: 1, margin: 0 }}>
                  {[0, 1].map((v) => (
                    <button
                      key={v}
                      className={`settings-option-btn ${currentRange.before === v ? 'active' : ''}`}
                      onClick={() => handleFocusRangeChange('before', v)}
                    >
                      {v} 週間前
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', minWidth: '70px' }}>基準週より後</span>
                <div className="settings-option-list" style={{ flex: 1, margin: 0 }}>
                  {[0, 1, 2].map((v) => (
                    <button
                      key={v}
                      className={`settings-option-btn ${currentRange.after === v ? 'active' : ''}`}
                      onClick={() => handleFocusRangeChange('after', v)}
                    >
                      {v} 週間後
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 週の開始日 */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="form-label" style={{ margin: 0 }}>週の開始日</span>
            <div style={{ display: 'inline-flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="weekStart"
                  checked={settings.weekStart === 'sunday'}
                  onChange={() => handleWeekStartChange('sunday')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                日曜
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="weekStart"
                  checked={settings.weekStart === 'monday'}
                  onChange={() => handleWeekStartChange('monday')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                月曜
              </label>
            </div>
          </div>

          {/* 表示期間 */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className="form-label" style={{ margin: 0 }}>表示できる期間</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                広めにすると起動や同期がやや遅くなります
              </span>
            </div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="calendarRange"
                  checked={settings.calendarRange === 'normal'}
                  onChange={() => handleCalendarRangeChange('normal')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                標準（過去3ヶ月・未来6ヶ月）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="calendarRange"
                  checked={settings.calendarRange === 'wide'}
                  onChange={() => handleCalendarRangeChange('wide')}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                広め（過去6ヶ月・未来12ヶ月）
              </label>
            </div>
          </div>

          {/* 祝日の地域 */}
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span className="form-label" style={{ margin: 0 }}>祝日の表示</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Googleカレンダーの祝日データを使用します</span>
            </div>

<select
  className="settings-select"
  value={settings.holidayRegion}
  onChange={(e) => handleHolidayRegionChange(e.target.value)}
>
  <option value={HOLIDAY_NONE}>表示しない</option>
  {HOLIDAY_REGIONS.map((r) => (
    <option key={r.id} value={r.id}>{r.label}</option>
  ))}

            </select>
          </div>

          {/* ベースカラー（旧：表示カラー） */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>ベースカラー</span>
            <div className="color-dot-container">
              <button
                className={`color-dot-btn monochrome ${settings.themeColor === 'monochrome' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('monochrome')}
                title="モノクロ"
              />
              <button
                className={`color-dot-btn red ${settings.themeColor === 'red' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('red')}
                title="赤系"
              />
              <button
                className={`color-dot-btn blue ${settings.themeColor === 'blue' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('blue')}
                title="青系"
              />
              <button
                className={`color-dot-btn yellow ${settings.themeColor === 'yellow' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('yellow')}
                title="黄系"
              />
              <button
                className={`color-dot-btn green ${settings.themeColor === 'green' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('green')}
                title="緑系"
              />
            </div>
          </div>

          {/* イベントカラー */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>イベントカラー</span>
            <div className="color-dot-container" style={{ flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-start' }}>
              <button
                className={`color-dot-btn event-default ${settings.eventColor === 'default' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('default')}
                title="テーマに合わせる"
              />
              <button
                className={`color-dot-btn event-monochrome ${settings.eventColor === 'monochrome' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('monochrome')}
                title="グレー"
              />
              <button
                className={`color-dot-btn event-red ${settings.eventColor === 'red' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('red')}
                title="レッド"
              />
              <button
                className={`color-dot-btn event-blue ${settings.eventColor === 'blue' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('blue')}
                title="ブルー"
              />
              <button
                className={`color-dot-btn event-yellow ${settings.eventColor === 'yellow' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('yellow')}
                title="イエロー"
              />
              <button
                className={`color-dot-btn event-green ${settings.eventColor === 'green' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('green')}
                title="グリーン"
              />
              <button
                className={`color-dot-btn event-purple ${settings.eventColor === 'purple' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('purple')}
                title="パープル"
              />
              <button
                className={`color-dot-btn event-pink ${settings.eventColor === 'pink' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('pink')}
                title="ピンク"
              />
              <button
                className={`color-dot-btn event-orange ${settings.eventColor === 'orange' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('orange')}
                title="オレンジ"
              />
              <button
                className={`color-dot-btn event-teal ${settings.eventColor === 'teal' ? 'active' : ''}`}
                onClick={() => handleEventColorChange('teal')}
                title="ティール"
              />
            </div>
          </div>

{/* ★ Googleカレンダーカラー設定（新規追加項目） */}
          {isLoggedIn && (
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="form-label" style={{ margin: 0 }}>カレンダー色の反映</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Googleカレンダーの色で予定を表示します</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.useGoogleColors}
                  onChange={(e) => handleUseGoogleColorsChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          )}

          {/* Google カレンダー連携 */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>Google カレンダー連携</span>
            {isLoggedIn ? (
              <div className="login-status-container">
                <div className="login-status-text">Googleアカウントと連携中</div>
                <div className="login-status-subtext">Googleカレンダーから予定を同期しています。</div>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={onLogout}
                >
                  連携解除
                </button>
              </div>
            ) : (
              <div className="login-status-container">
                <div className="login-status-text">未ログイン</div>
                <div className="login-status-subtext">Googleカレンダーと連携して予定を表示・管理できます。</div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={onLogin}
                >
                  Googleでログイン
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export type { Settings };