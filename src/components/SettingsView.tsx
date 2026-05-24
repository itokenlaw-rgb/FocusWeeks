import React from 'react';
import { X, LogIn, LogOut } from 'lucide-react';
import { requestAccessToken } from '../utils/googleCalendar';

interface Settings {
  textSize: 'small' | 'medium' | 'large';
  focusSize: 3 | 5;
  weekStart: 'monday' | 'sunday';
  themeColor: 'monochrome' | 'red' | 'blue' | 'yellow' | 'green';
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

  return (
    <div className="fullscreen-overlay active">
      <div className="fullscreen-header">
        <button onClick={onClose} className="icon-btn" aria-label="閉じる">
          <X size={24} />
        </button>
        <span className="fullscreen-title">設定</span>
        <div style={{ width: 40 }} /> {/* Spacer */}
      </div>

      <div className="fullscreen-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Text Size */}
        <div className="form-group">
          <span className="form-label" style={{ marginBottom: 8 }}>文字の大きさ</span>
          <div className="settings-option-list">
            <button
              className={`settings-option-btn ${settings.textSize === 'small' ? 'active' : ''}`}
              onClick={() => handleTextSizeChange('small')}
            >
              小
            </button>
            <button
              className={`settings-option-btn ${settings.textSize === 'medium' ? 'active' : ''}`}
              onClick={() => handleTextSizeChange('medium')}
            >
              中
            </button>
            <button
              className={`settings-option-btn ${settings.textSize === 'large' ? 'active' : ''}`}
              onClick={() => handleTextSizeChange('large')}
            >
              大
            </button>
          </div>
        </div>

        {/* Focus Size */}
        <div className="form-group">
          <span className="form-label" style={{ marginBottom: 8 }}>フォーカスの大きさ</span>
          <div className="settings-option-list">
            <button
              className={`settings-option-btn ${settings.focusSize === 3 ? 'active' : ''}`}
              onClick={() => handleFocusSizeChange(3)}
            >
              3倍
            </button>
            <button
              className={`settings-option-btn ${settings.focusSize === 5 ? 'active' : ''}`}
              onClick={() => handleFocusSizeChange(5)}
            >
              5倍
            </button>
          </div>
        </div>

        {/* Start of Week */}
        <div className="form-group">
          <span className="form-label" style={{ marginBottom: 8 }}>週の開始日</span>
          <div className="settings-option-list">
            <button
              className={`settings-option-btn ${settings.weekStart === 'sunday' ? 'active' : ''}`}
              onClick={() => handleWeekStartChange('sunday')}
            >
              日曜始まり
            </button>
            <button
              className={`settings-option-btn ${settings.weekStart === 'monday' ? 'active' : ''}`}
              onClick={() => handleWeekStartChange('monday')}
            >
              月曜始まり
            </button>
          </div>
        </div>

        {/* Theme Colors */}
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

        {/* Google Calendar Connection */}
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
                <LogOut size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
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
                <LogIn size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Googleでログイン
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export type { Settings };
