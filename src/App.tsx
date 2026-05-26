/* --- App.tsx の return 部分を修正 --- */
// ... (前略。Stateや関数定義などは変更ありません)

  return (
    <div className="app-container">
      {/* Duplication Active Banner */}
      {duplicateEvent && (
        <div className="duplicate-banner">
          <span>予定の複製中: 「{duplicateEvent.title}」</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
              onClick={() => setDuplicateEvent(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-title-container">
            <span className="header-year">{currentYear}年</span>
            <button 
              className="header-month icon-btn" 
              style={{ padding: '0 4px', borderRadius: '4px' }}
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            >
              {currentMonth + 1}月
              <ChevronDown size={16} />
            </button>
            
            {showMonthDropdown && (
              <div 
                style={{
                  position: 'absolute',
                  top: 50,
                  left: 16,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 200,
                  overflowY: 'auto'
                }}
              >
                {Array.from({ length: 12 }).map((_, idx) => {
                  const target = new Date();
                  target.setMonth(target.getMonth() - 3 + idx);
                  const year = target.getFullYear();
                  const month = target.getMonth();
                  return (
                    <button
                      key={idx}
                      style={{
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                      onClick={() => {
                        handleVisibleMonthChange(year, month);
                        const dateStr = getFormattedDateString(new Date(year, month, 1));
                        const targetWeekEl = document.querySelector(`[data-contains-date*="${dateStr}"]`);
                        if (targetWeekEl) {
                          targetWeekEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }
                        setShowMonthDropdown(false);
                      }}
                    >
                      {year}年 {month + 1}月
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn" aria-label="検索" onClick={() => alert('検索機能は開発中です。')}>
            <Search size={20} />
          </button>
          
          <div className="view-switch">
            <button 
              className={`switch-btn ${view === 'month' ? 'active' : ''}`}
              onClick={() => setView('month')}
            >
              月
            </button>
            <button 
              className={`switch-btn ${view === 'week' ? 'active' : ''}`}
              onClick={() => setView('week')}
            >
              週
            </button>
          </div>
        </div>
      </header>

      {/* Weekday labels row for Month view */}
      {view === 'month' && (
        <div className="weekday-header">
          {settings.weekStart === 'sunday' ? (
            <>
              <span className="sun">日</span>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span className="sat">土</span>
            </>
          ) : (
            <>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span className="sat">土</span>
              <span className="sun">日</span>
            </>
          )}
        </div>
      )}

      {/* Main Content Areas */}
      {/* 【２】ここに flex: 1 と flexDirection: column を持たせ、BottomPanelを内包します */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'month' ? (
          <MonthView
            weeks={weeks}
            events={events}
            selectedDate={selectedDate}
            focusedWeekId={focusedWeekId}
            settings={settings}
            onSelectDay={handleSelectDay}
            onVisibleMonthChange={handleVisibleMonthChange}
            onEventClick={handleOpenEditForm}
            duplicateMode={!!duplicateEvent}
            onPasteDuplicate={handlePasteDuplicate}
          />
        ) : (
          <WeekView
            weekDays={getWeekDaysForSelectedWeek()}
            events={events}
            onEventClick={handleOpenEditForm}
            onAddEventClick={(date, hour) => handleOpenAddForm(date, hour)}
            onMoveEvent={handleMoveEvent}
          />
        )}

        {/* Floating Add Event Button in Month View */}
        {view === 'month' && !selectedDate && (
          <button 
            className="floating-add-btn" 
            onClick={() => handleOpenAddForm(getFormattedDateString(new Date()), null)}
            aria-label="予定を追加"
          >
            <Plus size={24} />
          </button>
        )}

        {/* 【２】Bottom Sheet パネルを覆いかぶせるのではなく、カレンダーの下の兄弟要素に移動 */}
        {view === 'month' && (
          <div className={`bottom-panel-container ${isBottomPanelOpen ? 'active' : ''}`}>
            <BottomPanel
              isOpen={isBottomPanelOpen}
              selectedDate={selectedDate}
              events={events}
              onClose={() => {
                setIsBottomPanelOpen(false);
                setSelectedDate(null);
              }}
              onEventClick={handleOpenEditForm}
              onAddEventClick={handleOpenAddForm}
            />
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <footer className="app-navbar">
        <button 
          className="nav-today-btn" 
          onClick={() => {
            const today = new Date();
            const todayStr = getFormattedDateString(today);
            setSelectedDate(null);
            
            const targetWeekEl = document.querySelector(`[data-contains-date*="${todayStr}"]`);
            if (targetWeekEl) {
              targetWeekEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            
            if (weeks.length > 0) {
              const currentWeek = weeks.find(w => w.some(d => d.dateString === todayStr));
              if (currentWeek) {
                setFocusedWeekId(currentWeek[0].dateString);
              }
            }
            
            handleVisibleMonthChange(today.getFullYear(), today.getMonth());
          }}
        >
          今日
        </button>
        <span className="nav-date-label">
          {view === 'month' ? 'FocusWeeks' : '週表示'}
        </span>
        <button 
          className="nav-settings-btn" 
          onClick={() => setShowSettings(true)}
          aria-label="設定"
        >
          <SettingsIcon size={20} />
        </button>
      </footer>

      {/* Fullscreen Forms */}
      {activeForm && (
        <EventForm
          event={activeForm.event}
          initialDate={activeForm.date}
          initialTimeSlot={activeForm.timeSlot}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onCancel={() => setActiveForm(null)}
          onDuplicate={handleTriggerDuplicate}
        />
      )}

      {showSettings && (
        <SettingsView
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setShowSettings(false)}
          googleToken={googleToken}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
