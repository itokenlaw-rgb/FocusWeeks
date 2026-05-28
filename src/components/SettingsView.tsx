import React from 'react';
import { X } from 'lucide-react'; // 未使用の LogIn, LogOut を削除
import { requestAccessToken } from '../utils/googleCalendar';

interface Settings {
  textSize: 'small' | 'medium' | 'large';
  focusSize: 3 | 5;
  weekStart: 'monday' | 'sunday';
  themeColor: 'monochrome' | 'red' | 'blue' | 'yellow' | 'green';
  focusBefore: 0 | 1;
  focusAfter: 0 | 1 | 2;
}

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
  onClose: () => void;
  googleToken: string | null;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  googleToken,
  onLogout,
}) => {
  const handleTextSizeChange = (textSize: Settings['textSize']) => {
    onUpdateSettings({ ...settings, textSize });
  };

  const handleFocusSizeChange = (focusSize: Settings['focusSize']) => {
    onUpdateSettings({ ...settings, focusSize });
  };

  const handleWeekStartChange = (weekStart: Settings['weekStart']) => {
    onUpdateSettings({ ...settings, weekStart });
  };

  const handleThemeColorChange = (themeColor: Settings['themeColor']) => {
    onUpdateSettings({ ...settings, themeColor });
  };

  const handleFocusRangeChange = (type: 'before' | 'after', value: number) => {
    const nextSettings = { ...settings };
    
    if (type === 'before') {
      nextSettings.focusBefore = value as 0 | 1;
    } else {
      nextSettings.focusAfter = value as 0 | 1 | 2;
    }

    const totalSelected = nextSettings.focusBefore + nextSettings.focusAfter;
    if (totalSelected > 3) {
      if (type === 'before') {
        nextSettings.focusAfter = 2;
      } else {
        nextSettings.focusBefore = 1;
      }
    }

    onUpdateSettings(nextSettings);
  };

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
          
          {/* 文字の大きさ（1行でスッキリ化） */}
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

          {/* フォーカスの大きさ（1行でスッキリ化） */}
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

          {/* フォーカスの対象 */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>フォーカスの対象</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', minWidth: '70px' }}>基準週より前</span>
                <div className="settings-option-list" style={{ flex: 1, margin: 0 }}>
                  {[0, 1].map((v) => (
                    <button
                      key={v}
                      className={`settings-option-btn ${settings.focusBefore === v ? 'active' : ''}`}
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
                      className={`settings-option-btn ${settings.focusAfter === v ? 'active' : ''}`}
                      onClick={() => handleFocusRangeChange('after', v)}
                    >
                      {v} 週間後
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 週の開始日（1行でスッキリ化） */}
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

          {/* 表示カラー */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>表示カラー</span>
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

          {/* Google カレンダー連携 */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>Google カレンダー連携</span>
            {googleToken ? (
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
                  onClick={requestAccessToken}
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