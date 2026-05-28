import React from 'react';
import { X, LogIn, LogOut } from 'lucide-react';
import { requestAccessToken } from '../utils/googleCalendar';

interface Settings {
  textSize: 'small' | 'medium' | 'large';
  focusSize: 3 | 5;
  weekStart: 'monday' | 'sunday';
  themeColor: 'monochrome' | 'red' | 'blue' | 'yellow' | 'green';
  focusBefore: 0 | 1;      // 追加: フォーカスする前の週数
  focusAfter: 0 | 1 | 2;   // 追加: フォーカスする後の週数
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

  // フォーカス範囲変更用のハンドラー（合計最大4週間分のバリデーション付き）
  const handleFocusRangeChange = (type: 'before' | 'after', value: number) => {
    const nextSettings = { ...settings };
    
    if (type === 'before') {
      nextSettings.focusBefore = value as 0 | 1;
    } else {
      nextSettings.focusAfter = value as 0 | 1 | 2;
    }

    // 「前」+「現在の週(1)」+「後」の合計が 4 を超える場合
    // 最大4週間(選択値としては前1 + 後2 = 3)に収まるようにもう片方を自動で補正
    const totalSelected = nextSettings.focusBefore + nextSettings.focusAfter;
    if (totalSelected > 3) {
      if (type === 'before') {
        nextSettings.focusAfter = 2; // 前を1にするなら、後は自動的に最大値の2に固定
      } else {
        nextSettings.focusBefore = 1; // 後を2にするなら、前は自動的に最大値の1に固定
      }
    }

    onUpdateSettings(nextSettings);
  };

  return (
    /* 1. 一番外側の背景グレー（半透明）の膜 */
    <div className="fullscreen-overlay" onClick={onClose}>
      
      {/* 2. 中央に配置される白いカード領域 */}
      <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* ヘッダー領域 */}
        <div className="fullscreen-header">
          <button onClick={onClose} className="icon-btn" aria-label="閉じる">
            <X size={24} />
          </button>
          <span className="fullscreen-title">設定</span>
          <div style={{ width: 40 }} /> {/* 右側の余白調整用 */}
        </div>

        {/* スクロール可能な設定項目エリア */}
        <div className="fullscreen-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* 文字の大きさ */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>文字の大きさ</span>
            <div className="settings-option-list">
              <button
                className={`settings-option-btn ${settings.textSize === 'small' ? 'active' : ''}`}
                onClick={() => handleTextSizeChange('small')}
              >
                小さめ
              </button>
              <button
                className={`settings-option-btn ${settings.textSize === 'medium' ? 'active' : ''}`}
                onClick={() => handleTextSizeChange('medium')}
              >
                標準
              </button>
              <button
                className={`settings-option-btn ${settings.textSize === 'large' ? 'active' : ''}`}
                onClick={() => handleTextSizeChange('large')}
              >
                大きめ
              </button>
            </div>
          </div>

          {/* フォーカスの大きさ */}
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

          {/* 新設：フォーカスの対象（範囲設定） */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>フォーカスの対象</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* ●週前の選択 */}
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

              {/* ●週後の選択 */}
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

          {/* 週の開始日 */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>週の開始日</span>
            <div className="settings-option-list">
              <button
                className={`settings-option-btn ${settings.weekStart === 'monday' ? 'active' : ''}`}
                onClick={() => handleWeekStartChange('monday')}
              >
                月曜日
              </button>
              <button
                className={`settings-option-btn ${settings.weekStart === 'sunday' ? 'active' : ''}`}
                onClick={() => handleWeekStartChange('sunday')}
              >
                日曜日
              </button>
            </div>
          </div>

          {/* 表示カラー */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 8 }}>表示カラー</span>
            <div className="settings-option-list">
              <button
                className={`settings-option-btn ${settings.themeColor === 'blue' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('blue')}
              >
                ブルー
              </button>
              <button
                className={`settings-option-btn ${settings.themeColor === 'green' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('green')}
              >
                グリーン
              </button>
              <button
                className={`settings-option-btn ${settings.themeColor === 'red' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('red')}
              >
                レッド
              </button>
              <button
                className={`settings-option-btn ${settings.themeColor === 'yellow' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('yellow')}
              >
                イエロー
              </button>
              <button
                className={`settings-option-btn ${settings.themeColor === 'monochrome' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('monochrome')}
              >
                モノクロ
              </button>
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
    </div>
  );
};

export type { Settings };