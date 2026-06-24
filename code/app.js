// ==========================================
// 1. アプリケーション状態 & 初期設定
// ==========================================

let state = {
    weeklySchedule: [], // { id, title, day, timeblock, startTime, endTime, category, color, notes }
    todos: [],          // { id, title, category, priority, deadline, notes, completed }
    events: [],         // { id, title, start, end, color, notes }
    settings: {
        saturday: true,       // 週間プランナーに土日を表示するか
        mondayStart: true,    // カレンダーを月曜始まりにするか
        theme: 'light'        // カラーテーマ
    },
    timetableImage: ""       // 参照スケジュール画像 (base64)
};

// 曜日定義
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const DAY_LABELS_JP = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

const CATEGORIES = {
    work: { label: "仕事", icon: "💼" },
    private: { label: "プライベート", icon: "🏠" },
    shopping: { label: "買い物", icon: "🛒" },
    other: { label: "その他", icon: "💡" }
};

// カラーパレット
const THEME_COLORS = [
    "#4F46E5", // Indigo
    "#0EA5E9", // Sky
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Rose
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#F97316"  // Orange
];


// カレンダー表示管理用
let currentCalendarDate = new Date();

// ==========================================
// 2. 初期化 & ロード
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    initTheme();
    initEventListeners();

    // レンダリング実行
    renderDashboard();
    renderWeeklyPlanner();
    renderSplitView();
    renderCalendar();
    renderTodoList();
    renderSettings();

    // カラーピッカー初期化
    initColorPickers();
    requestNotificationPermission(); // 起動時に通知許可をリクエスト

});

function getEmptyState() {
    return {
        weeklySchedule: [],
        todos: [],
        events: [],
        settings: {
            saturday: true,
            mondayStart: true,
            theme: 'light'
        },
        timetableImage: ""
    };
}

function loadData() {
    const saved = localStorage.getItem("campus_organizer_data");
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("データの読み込みに失敗しました。データを初期化します。", e);
            state = getEmptyState();
        }
    } else {
        state = getEmptyState();
        saveData();
    }

    // データの整合性を保証するガードレール
    if (!state) state = {};
    if (!Array.isArray(state.weeklySchedule)) state.weeklySchedule = [];
    if (!Array.isArray(state.todos)) state.todos = [];
    if (!Array.isArray(state.events)) state.events = [];
    if (!state.settings || typeof state.settings !== 'object') {
        state.settings = { saturday: true, mondayStart: true, theme: 'light' };
    } else {
        if (state.settings.saturday === undefined) state.settings.saturday = true;
        if (state.settings.mondayStart === undefined) state.settings.mondayStart = true;
        if (state.settings.theme === undefined) state.settings.theme = 'light';
    }
    if (state.timetableImage === undefined) state.timetableImage = "";

    state.todos.forEach(t => {
        if (t.recurrence === undefined) t.recurrence = "none";
    });
    state.events.forEach(e => {
        if (e.allDay === undefined) e.allDay = false;
        if (e.recurrence === undefined) e.recurrence = "none";
        if (e.location === undefined) e.location = "";
        if (e.travelTime === undefined) e.travelTime = 0;
    });
}

function saveData() {
    localStorage.setItem("campus_organizer_data", JSON.stringify(state));
}

function initTheme() {
    const theme = state.settings.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

// 通知の許可をリクエストする関数
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("このブラウザは通知に対応していません。");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("通知が許可されました！");
                // テスト用の即時通知
                new Notification("TimeMatch", { body: "通知機能が有効になりました！" });
            }
        });
    }
}

// ==========================================
// 3. UI描画ロジック
// ==========================================

// --- 1. ダッシュボード画面の描画 ---
function renderDashboard() {
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 (${DAYS[now.getDay()]})`;
    document.getElementById("dash-date").innerText = dateStr;

    // ① 今日のスケジュールリスト (週間定期 ＋ 単発イベント)
    const scheduleContainer = document.getElementById("dashboard-schedule");
    scheduleContainer.innerHTML = "";

    const todayDayOfWeek = now.getDay(); // 0:日, 1:月...
    const todayDateISO = formatDateISO(now);

    // 今日の週間定期
    const todayWeekly = state.weeklySchedule.filter(w => w.day === todayDayOfWeek);

    // 今日のカレンダー単発・繰り返しイベント
    const todayEvents = state.events.filter(ev => isEventOnDate(ev, todayDateISO));

    // 予定を合流し、並べ替えて表示
    let mergedSchedule = [];

    todayWeekly.forEach(w => {
        let timeLabel = "";
        let sortVal = 0;

        if (w.timeblock === 'morning') { timeLabel = "🌅 朝"; sortVal = 6; }
        else if (w.timeblock === 'afternoon') { timeLabel = "☀️ 昼"; sortVal = 12; }
        else if (w.timeblock === 'evening') { timeLabel = "🌙 夜"; sortVal = 18; }
        else {
            timeLabel = `🕰️ ${w.startTime}`;
            const parts = w.startTime.split(":");
            sortVal = parseInt(parts[0]) + (parseInt(parts[1]) / 60);
        }

        mergedSchedule.push({
            type: 'weekly',
            title: w.title,
            timeLabel: timeLabel,
            sortVal: sortVal,
            color: w.color,
            notes: w.notes,
            category: w.category,
            id: w.id
        });
    });

    todayEvents.forEach(ev => {
        let timeLabel = "📌 ";
        let sortVal = 0;
        if (ev.allDay) {
            timeLabel += "終日";
            sortVal = 0;
        } else {
            const timePart = ev.start.split("T")[1] || "00:00";
            timeLabel += timePart;
            const parts = timePart.split(":");
            sortVal = parseInt(parts[0]) + (parseInt(parts[1]) / 60);
        }

        let notesText = ev.notes || "";
        if (ev.location) {
            notesText = `📍 ${ev.location}` + (notesText ? ` | ${notesText}` : "");
        }
        if (ev.travelTime) {
            notesText = `🚗 移動: ${ev.travelTime}分` + (notesText ? ` | ${notesText}` : "");
        }

        mergedSchedule.push({
            type: 'event',
            title: ev.title,
            timeLabel: timeLabel,
            sortVal: sortVal,
            color: ev.color,
            notes: notesText,
            id: ev.id
        });
    });

    // 時間順にソート
    mergedSchedule.sort((a, b) => a.sortVal - b.sortVal);

    if (mergedSchedule.length === 0) {
        scheduleContainer.innerHTML = `<div class="dash-item empty">☕ 今日の予定はありません。</div>`;
    } else {
        mergedSchedule.forEach(item => {
            const card = document.createElement("div");
            card.className = "dash-item";
            card.style.borderLeftColor = item.color || "var(--primary)";

            const catLabel = item.category ? `<span class="tag-badge ${item.category}" style="margin-left:8px; font-size:0.6rem; vertical-align:middle;">${CATEGORIES[item.category].label}</span>` : '';

            card.innerHTML = `
                <div>
                    <div style="font-weight:700; font-size:0.9rem;">
                        ${item.timeLabel} : ${item.title}
                        ${catLabel}
                    </div>
                    ${item.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${item.notes}</div>` : ''}
                </div>
            `;
            scheduleContainer.appendChild(card);
        });
    }

    // ② タスク完了進捗
    calculateTodoProgress();

    // ③ 締め切りの近いTodo (3件)
    const todosContainer = document.getElementById("dashboard-todos");
    todosContainer.innerHTML = "";

    const activeTodos = state.todos
        .filter(t => !t.completed)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (activeTodos.length === 0) {
        todosContainer.innerHTML = `<div class="dash-item empty">✨ 期限のある課題はありません！</div>`;
    } else {
        activeTodos.slice(0, 3).forEach(todo => {
            const countdownInfo = getCountdown(todo.deadline);
            const countdownClass = countdownInfo.days <= 1 ? "danger" : (countdownInfo.days <= 3 ? "warning" : "safe");

            const item = document.createElement("div");
            item.className = "dash-item";
            item.style.borderLeftColor = todo.priority === 'high' ? 'var(--accent-red)' : (todo.priority === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-green)');

            const freeTime = calculateFreeTimeRemaining(todo.deadline);
            const balancerClass = freeTime < 3 ? 'danger' : '';
            const balancerIcon = freeTime < 3 ? '🚨' : '🕒';
            const balancerBadge = `<span class="balancer-badge ${balancerClass}">${balancerIcon} 実質残り: ${freeTime}h</span>`;

            item.innerHTML = `
                <div>
                    <div style="font-weight:700; font-size:0.95rem;">${todo.title}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        ${balancerBadge}
                        <span>🏷️ ${CATEGORIES[todo.category].icon} ${CATEGORIES[todo.category].label}</span>
                        <span>| 📅 締切: ${formatDate(todo.deadline)}</span>
                    </div>
                </div>
                <div class="todo-countdown ${countdownClass}">${countdownInfo.text}</div>
            `;
            todosContainer.appendChild(item);
        });
    }
}

// 予定タイプ別のページジャンプ
function jumpToPage(pageId) {
    if (pageId === 'timetable') {
        switchPage('timetable', '週間プランナー');
    } else if (pageId === 'calendar') {
        switchPage('calendar', 'カレンダー');
    }
}

// Todoの進捗（円ゲージ）計算
function calculateTodoProgress() {
    const totalCount = state.todos.length;
    const completedCount = state.todos.filter(t => t.completed).length;
    const activeCount = totalCount - completedCount;

    let percent = 0;
    if (totalCount > 0) {
        percent = Math.round((completedCount / totalCount) * 100);
    }

    // UIパーツ更新
    document.getElementById("todo-completed-count").innerText = completedCount;
    document.getElementById("todo-active-count").innerText = activeCount;
    document.getElementById("progress-percent-text").innerText = `${percent}%`;

    // 円のゲージオフセット更新 (r=30 の円の外周は 2*PI*r ≒ 188.4)
    const circle = document.getElementById("progress-circle");
    const circumference = 2 * Math.PI * 30; // ≒ 188.495
    circle.style.strokeDasharray = circumference;

    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

// --- 2. 週間プランナー画面の描画 (A案: 曜日カードリスト) ---
function renderWeeklyPlanner() {
    const container = document.getElementById("weekly-planner-container");
    if (!container) return;
    container.innerHTML = "";

    const showSatSun = state.settings.saturday;

    // 週の始まりの設定（月曜始まり ⇄ 日曜始まり）で描画順を決定
    let dayOrder = [];
    if (state.settings.mondayStart) {
        dayOrder = showSatSun ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5];
    } else {
        dayOrder = showSatSun ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
    }

    const todayDay = new Date().getDay();

    dayOrder.forEach(day => {
        const card = document.createElement("div");
        card.className = "weekly-day-card";
        if (day === todayDay) {
            card.classList.add("today-card");
        }

        // この曜日の予定
        const daySchedules = state.weeklySchedule.filter(w => w.day === day);

        // 予定のソート (朝 ➔ 昼 ➔ 夜 ➔ 時間指定)
        daySchedules.sort((a, b) => {
            const getSortVal = (item) => {
                if (item.timeblock === 'morning') return 1;
                if (item.timeblock === 'afternoon') return 2;
                if (item.timeblock === 'evening') return 3;
                if (item.timeblock === 'specific') {
                    const timeParts = item.startTime.split(":");
                    return 4 + (parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60) / 24;
                }
                return 5;
            };
            return getSortVal(a) - getSortVal(b);
        });

        // 曜日カードヘッダー
        const header = document.createElement("div");
        header.className = "weekly-day-header";
        header.innerHTML = `
            <div class="weekly-day-name">
                <span style="font-size:1.1rem;">🗓️</span>
                <span>${DAY_LABELS_JP[day]}</span>
            </div>
            <button class="weekly-add-btn" onclick="openAddWeeklyEvent(${day})">＋ 予定を追加</button>
        `;
        card.appendChild(header);

        // 予定リスト
        const list = document.createElement("div");
        list.className = "time-blocks-list";

        if (daySchedules.length === 0) {
            list.innerHTML = `<div style="font-size:0.75rem; color:var(--text-secondary); text-align:center; padding:10px 0; border:1px dashed var(--border); border-radius:var(--radius-sm);">繰り返しの予定はありません</div>`;
        } else {
            daySchedules.forEach(schedule => {
                const item = document.createElement("div");
                item.className = "time-block-item";
                item.style.borderLeftColor = schedule.color || "var(--primary)";

                // 時間帯表示テキスト
                let timeStr = "";
                if (schedule.timeblock === 'morning') timeStr = "🌅 朝";
                else if (schedule.timeblock === 'afternoon') timeStr = "☀️ 昼";
                else if (schedule.timeblock === 'evening') timeStr = "🌙 夜";
                else timeStr = `🕰️ ${schedule.startTime}〜${schedule.endTime}`;

                item.onclick = () => openEditWeeklyEvent(schedule.id);

                item.innerHTML = `
                    <div class="time-block-left">
                        <span class="time-block-meta">${timeStr}</span>
                        <div>
                            <span class="time-block-title">${schedule.title}</span>
                            <span class="tag-badge ${schedule.category}" style="margin-left:6px; font-size:0.6rem;">${CATEGORIES[schedule.category].label}</span>
                        </div>
                    </div>
                    <button class="btn-item-delete" onclick="deleteWeeklySchedule('${schedule.id}', event)" title="削除">🗑️</button>
                `;
                list.appendChild(item);
            });
        }

        card.appendChild(list);
        container.appendChild(card);
    });
}

// --- 3. 見比べ画面 (スプリットビュー) の描画 ---
let splitDateOffset = 0; // 0=今日, 1=翌日, -1=前日...

function moveSplitDate(direction) {
    if (direction === 0) {
        splitDateOffset = 0; // 今日に戻る
    } else {
        splitDateOffset += direction;
    }
    renderSplitView();
}

function renderSplitView() {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + splitDateOffset);

    const isToday = splitDateOffset === 0;
    const dateStr = `${baseDate.getMonth() + 1}月${baseDate.getDate()}日 (${DAYS[baseDate.getDay()]})`;

    // タイトルの切り替え
    const titleEl = document.getElementById("split-schedule-title");


    const dateEl = document.getElementById("split-date");
    if (dateEl) dateEl.innerText = dateStr;

    // 左側：今日のスケジュール（タイムライン ＆ 空き時間）
    const leftContainer = document.getElementById("split-schedule-content");
    if (leftContainer) {
        leftContainer.innerHTML = "";

        const todayDayOfWeek = baseDate.getDay();
        const todayDateISO = formatDateISO(baseDate);

        // 選択日の習慣予定と単発予定
        const todayWeekly = state.weeklySchedule.filter(w => w.day === todayDayOfWeek);
        const todayEvents = state.events.filter(ev => isEventOnDate(ev, todayDateISO));

        // 予定を分単位にパース
        let parsed = [];
        let dayStart = 480;  // 08:00
        let dayEnd = 1320;   // 22:00

        todayWeekly.forEach(w => {
            let start, end;
            if (w.timeblock === 'morning') {
                start = 480; // 08:00
                end = 600;   // 10:00
            } else if (w.timeblock === 'afternoon') {
                start = 780; // 13:00
                end = 900;   // 15:00
            } else if (w.timeblock === 'evening') {
                start = 1080; // 18:00
                end = 1200;   // 20:00
            } else {
                const sParts = (w.startTime || "09:00").split(":");
                start = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);
                const eParts = (w.endTime || "10:00").split(":");
                end = parseInt(eParts[0]) * 60 + parseInt(eParts[1]);
                if (end <= start) end = start + 60;
            }
            parsed.push({
                id: w.id,
                title: w.title,
                start: start,
                end: end,
                color: w.color || "var(--primary)",
                type: 'weekly',
                category: w.category,
                notes: w.notes
            });
        });

        todayEvents.forEach(ev => {
            let start, end;
            if (ev.allDay) {
                start = 480; // 08:00
                end = 1320;  // 22:00
            } else {
                const startStr = ev.start.split("T")[1] || "09:00";
                const sParts = startStr.split(":");
                start = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);

                let endStr = "10:00";
                if (ev.end) {
                    endStr = ev.end.split("T")[1] || "10:00";
                } else {
                    const endH = String(Math.floor(start / 60) + 1).padStart(2, '0');
                    const endM = String(start % 60).padStart(2, '0');
                    endStr = `${endH}:${endM}`;
                }
                const eParts = endStr.split(":");
                end = parseInt(eParts[0]) * 60 + parseInt(eParts[1]);
            }
            if (end <= start) end = start + 60;

            let notesText = ev.notes || "";
            if (ev.location) {
                notesText = `📍 ${ev.location}` + (notesText ? ` | ${notesText}` : "");
            }
            if (ev.travelTime) {
                notesText = `🚗 移動: ${ev.travelTime}分` + (notesText ? ` | ${notesText}` : "");
            }

            parsed.push({
                id: ev.id,
                title: ev.title,
                start: start,
                end: end,
                color: ev.color || "var(--accent-blue)",
                type: 'event',
                notes: notesText
            });
        });

        // 開始時間順にソート
        parsed.sort((a, b) => a.start - b.start);

        // 活動範囲を実際の予定に合わせて拡張
        parsed.forEach(p => {
            if (p.start < dayStart) dayStart = p.start;
            if (p.end > dayEnd) dayEnd = p.end;
        });

        // 重複予定のマージ
        let merged = [];
        parsed.forEach(p => {
            if (merged.length === 0) {
                merged.push({
                    start: p.start,
                    end: p.end,
                    items: [p]
                });
            } else {
                let last = merged[merged.length - 1];
                if (p.start < last.end) {
                    last.end = Math.max(last.end, p.end);
                    last.items.push(p);
                } else {
                    merged.push({
                        start: p.start,
                        end: p.end,
                        items: [p]
                    });
                }
            }
        });

        // 空き時間を含むタイムラインを構築
        let timelineItems = [];
        let current = dayStart;

        merged.forEach(block => {
            // 予定ブロックの前に10分以上の空きがあるか
            if (block.start - current >= 10) {
                timelineItems.push({
                    type: 'free',
                    start: current,
                    end: block.start
                });
            }
            // 予定ブロックを追加
            timelineItems.push({
                type: 'busy',
                start: block.start,
                end: block.end,
                items: block.items
            });
            current = block.end;
        });

        // 最後の空き時間
        if (dayEnd - current >= 10) {
            timelineItems.push({
                type: 'free',
                start: current,
                end: dayEnd
            });
        }

        const formatTime = (min) => {
            const h = String(Math.floor(min / 60)).padStart(2, '0');
            const m = String(min % 60).padStart(2, '0');
            return `${h}:${m}`;
        };

        if (timelineItems.length === 0) {
            const emptyMsg = isToday ? "☕ 今日の予定はありません。" : `☕ この日の予定はありません。`;
            leftContainer.innerHTML = `<div class="dash-item empty">${emptyMsg}</div>`;
        } else {
            timelineItems.forEach(item => {
                if (item.type === 'free') {
                    const diffMin = item.end - item.start;
                    const hours = Math.floor(diffMin / 60);
                    const mins = diffMin % 60;
                    const durationText = hours > 0 ? (mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`) : `${mins}分`;
                    const rangeText = `${formatTime(item.start)} 〜 ${formatTime(item.end)}`;

                    const slot = document.createElement("div");
                    slot.className = "timeline-free-slot";
                    slot.innerHTML = `
                        <div class="timeline-free-slot-left">
                            <span class="timeline-free-time-range">${rangeText}</span>
                            <span class="timeline-free-label">💡 空き時間：${durationText}</span>
                        </div>
                        <button class="btn-timeline-add" onclick="openAddEventFromTimeline('${formatTime(item.start)}', '${formatTime(item.end)}')">＋ 予定を追加</button>
                    `;
                    leftContainer.appendChild(slot);
                } else {
                    // busyスロット
                    item.items.forEach(p => {
                        const slot = document.createElement("div");
                        slot.className = "timeline-slot";
                        slot.style.borderLeftColor = p.color;

                        const catBadge = p.category ? `
                            <span class="tag-badge ${p.category}" style="margin-left: 8px;">
                                ${CATEGORIES[p.category].icon} ${CATEGORIES[p.category].label}
                            </span>
                        ` : '';

                        slot.style.cursor = "pointer";
                        slot.onclick = (e) => {
                            if (!e.target.closest('.btn-item-delete') && !e.target.closest('.btn-reschedule')) {
                                openEditEventOrWeekly(p.id, p.type);
                            }
                        };

                        const rescheduleBtn = p.type === 'event' ? `
                            <button class="btn-reschedule" onclick="rescheduleEvent('${p.id}', '${p.type}'); event.stopPropagation();" title="翌日以降の空き時間にリスケ">🔄</button>
                        ` : '';

                        slot.innerHTML = `
                            <div style="flex: 1;">
                                <div style="font-weight: 700; font-size: 0.9rem;">
                                    🕒 ${formatTime(p.start)} 〜 ${formatTime(p.end)} : ${p.title}
                                    ${catBadge}
                                </div>
                                ${p.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${p.notes}</div>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                ${rescheduleBtn}
                                <button class="btn-item-delete" onclick="deleteEventOrWeekly('${p.id}', '${p.type}', event)" title="削除">🗑️</button>
                            </div>
                        `;
                        leftContainer.appendChild(slot);
                    });
                }
            });
        }
    }

    // 右側：Todoリスト（締め切り間近のTodoを簡略描画）
    const rightContainer = document.getElementById("split-todo-content");
    if (rightContainer) {
        rightContainer.innerHTML = "";

        // 締め切りの近い順にソートした未完了Todo
        const activeTodos = state.todos
            .filter(t => !t.completed)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        if (activeTodos.length === 0) {
            rightContainer.innerHTML = `<div class="dash-item empty" style="font-size:0.85rem; padding:15px;">未完了のTodoはありません。</div>`;
        } else {
            activeTodos.forEach(todo => {
                const countdownInfo = getCountdown(todo.deadline);
                const countdownClass = countdownInfo.days <= 1 ? "danger" : (countdownInfo.days <= 3 ? "warning" : "safe");

                const card = document.createElement("div");
                card.className = "todo-item-card";
                card.style.padding = "12px 14px";
                card.style.cursor = "pointer";
                card.onclick = (e) => {
                    if (!e.target.closest('.todo-checkbox') && !e.target.closest('.btn-item-delete')) {
                        openEditTodo(todo.id, e);
                    }
                };
                card.innerHTML = `
                    <div class="todo-left" style="gap:8px;">
                        <div class="todo-checkbox" onclick="toggleTodoCompleted('${todo.id}', event)"></div>
                        <div class="todo-info-group">
                            <div class="todo-main-title" style="font-size:0.9rem;">${todo.title}</div>
                            <div style="font-size:0.7rem; color:var(--text-secondary);">📅 ${formatDateShort(todo.deadline)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="todo-countdown ${countdownClass}" style="font-size:0.65rem; padding:2px 8px;">${countdownInfo.text}</div>
                        <button class="btn-item-delete" onclick="deleteTodo('${todo.id}', event)" title="削除">🗑️</button>
                    </div>
                `;
                rightContainer.appendChild(card);
            });
        }
    }
}

// --- 4. カレンダー画面の描画 ---
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth(); // 0-11

    const isMonStart = state.settings.mondayStart;
    const showSatSun = state.settings.saturday;

    // 曜日の順序決定
    let weekDaysIndices = [];
    if (isMonStart) {
        weekDaysIndices = showSatSun ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5];
    } else {
        weekDaysIndices = showSatSun ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
    }

    const cols = weekDaysIndices.length;

    // ==== 週ビューか月ビューか ====
    if (currentCalendarView === 'week') {
        renderWeekView(weekDaysIndices, cols, showSatSun);
    } else {
        renderMonthView(year, month, weekDaysIndices, cols, showSatSun);
    }
}

function renderMonthView(year, month, weekDaysIndices, cols, showSatSun) {
    document.getElementById("calendar-month-year").innerText = `${year}年 ${month + 1}月`;

    // ==== 曜日ヘッダー（別要素）の描画 ====
    const weekdayHeader = document.getElementById("calendar-weekday-header");
    weekdayHeader.innerHTML = "";
    weekdayHeader.style.display = ""; // 週ビューで非表示にした場合のリセット
    weekdayHeader.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    weekDaysIndices.forEach(idx => {
        const hCell = document.createElement("div");
        hCell.className = "calendar-day-header";
        if (idx === 6) hCell.classList.add("sat-col");
        if (idx === 0) hCell.classList.add("sun-col");
        hCell.innerText = DAYS[idx];
        weekdayHeader.appendChild(hCell);
    });

    // ==== 日付グリッドの描画 ====
    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";
    // 週ビューから戻った際のstyleリセット
    grid.style.display = "";
    grid.style.padding = "";
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // 月初の日付情報
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // 月初の曜日（0=日, 1=月...）
    const firstDow = firstDayOfMonth.getDay();

    // グリッドの先頭が何曜日か（周の先頭）
    const gridStartDow = weekDaysIndices[0];

    // 前月の入り数少ない配置丸め：月初の曜日からグリッド先頭曜日を引いた差
    let startOffset = (firstDow - gridStartDow + 7) % 7;

    let cells = [];

    // 前月の余白
    for (let i = startOffset - 1; i >= 0; i--) {
        const dNum = prevMonthLastDay - i;
        const cDate = new Date(year, month - 1, dNum);
        if (showSatSun || (cDate.getDay() !== 0 && cDate.getDay() !== 6)) {
            cells.push({ date: cDate, currentMonth: false });
        }
    }

    // 当月の日付
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
        const cDate = new Date(year, month, d);
        if (showSatSun || (cDate.getDay() !== 0 && cDate.getDay() !== 6)) {
            cells.push({ date: cDate, currentMonth: true });
        }
    }

    // 翌月の余白（6週分）
    const totalCells = cols * 6;
    let nextD = 1;
    while (cells.length < totalCells) {
        const cDate = new Date(year, month + 1, nextD++);
        if (showSatSun || (cDate.getDay() !== 0 && cDate.getDay() !== 6)) {
            cells.push({ date: cDate, currentMonth: false });
        }
    }

    renderCalendarCells(cells, grid, true);
}

function renderWeekView(weekDaysIndices, cols, showSatSun) {
    const HOUR_PX = 60; // 1時間 = 60px
    const HOURS = 24;   // 0〜23時

    // 現在の日付から週の先頭を算出
    const baseDate = new Date(currentCalendarDate);
    const dow = baseDate.getDay();
    const gridStartDow = weekDaysIndices[0];
    const diff = (dow - gridStartDow + 7) % 7;
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() - diff);

    // 週の日付リストを構築
    const cells = [];
    for (let i = 0; i < cols; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        cells.push(d);
    }

    // ヘッダータイトルを週の範囲で表示
    const weekEnd = cells[cells.length - 1];
    const startStr = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    document.getElementById("calendar-month-year").innerText =
        `${weekStart.getFullYear()}年 ${startStr}〜${endStr}`;

    // 既存の曜日ヘッダーとグリッドを非表示にして、バーチカルビューをグリッドに描画
    const weekdayHeader = document.getElementById("calendar-weekday-header");
    if (weekdayHeader) { weekdayHeader.innerHTML = ""; weekdayHeader.style.display = "none"; }

    const grid = document.getElementById("calendar-grid");
    if (!grid) return;
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = "";
    grid.style.display = "block";
    grid.style.padding = "0";

    const today = new Date();
    const todayISO = formatDateISO(today);

    // ==== バーチカルビューのラッパー ====
    const wrapper = document.createElement("div");
    wrapper.className = "week-view-wrapper";

    // ---- 上部 曜日ヘッダー行 ----
    const headerRow = document.createElement("div");
    headerRow.className = "week-header-row";

    const headerTimeCol = document.createElement("div");
    headerTimeCol.className = "week-header-time-col";
    headerRow.appendChild(headerTimeCol);

    const headerDays = document.createElement("div");
    headerDays.className = "week-header-days";
    headerDays.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    cells.forEach(d => {
        const dayIdx = d.getDay();
        const dISO = formatDateISO(d);
        const cell = document.createElement("div");
        cell.className = "week-header-day-cell";
        if (dayIdx === 6) cell.classList.add("sat-col");
        if (dayIdx === 0) cell.classList.add("sun-col");
        if (dISO === todayISO) cell.classList.add("today-col");

        const nameSpan = document.createElement("span");
        nameSpan.className = "week-day-name";
        nameSpan.textContent = DAYS[dayIdx];

        const numSpan = document.createElement("span");
        numSpan.className = "week-day-num";
        numSpan.textContent = d.getDate();

        cell.appendChild(nameSpan);
        cell.appendChild(numSpan);
        headerDays.appendChild(cell);
    });
    headerRow.appendChild(headerDays);
    wrapper.appendChild(headerRow);

    // ---- スクロール可能なボディ ----
    const scrollBody = document.createElement("div");
    scrollBody.className = "week-scroll-body";

    const timeGrid = document.createElement("div");
    timeGrid.className = "week-time-grid";
    timeGrid.style.height = `${HOURS * HOUR_PX}px`;

    // 時間ラベル列
    const hoursCol = document.createElement("div");
    hoursCol.className = "week-hours-col";
    hoursCol.style.height = `${HOURS * HOUR_PX}px`;
    for (let h = 0; h < HOURS; h++) {
        const label = document.createElement("div");
        label.className = "week-hour-label";
        label.style.top = `${h * HOUR_PX}px`;
        label.textContent = h === 0 ? "" : `${h}:00`;
        hoursCol.appendChild(label);

        // 水平グリッド線（時間列内にも描画）
        const line = document.createElement("div");
        line.className = "week-grid-line";
        line.style.top = `${h * HOUR_PX}px`;
        hoursCol.appendChild(line);
    }
    timeGrid.appendChild(hoursCol);

    // 曜日カラム群
    const weekCols = document.createElement("div");
    weekCols.className = "week-columns";
    weekCols.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    weekCols.style.height = `${HOURS * HOUR_PX}px`;

    cells.forEach(d => {
        const dISO = formatDateISO(d);
        const colDiv = document.createElement("div");
        colDiv.className = "week-day-col";

        // 時間グリッド線
        for (let h = 0; h < HOURS; h++) {
            const line = document.createElement("div");
            line.className = "week-grid-line";
            line.style.top = `${h * HOUR_PX}px`;
            colDiv.appendChild(line);

            const half = document.createElement("div");
            half.className = "week-grid-line-half";
            half.style.top = `${h * HOUR_PX + HOUR_PX / 2}px`;
            colDiv.appendChild(half);
        }

        // カラムタップで予定追加
        colDiv.addEventListener("click", (e) => {
            if (e.target === colDiv) {
                const rect = colDiv.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const clickedHour = Math.floor(offsetY / HOUR_PX);
                const dt = new Date(d);
                dt.setHours(clickedHour, 0, 0, 0);
                openAddEvent(dt);
            }
        });

        // ==== イベントの配置計算 ====
        const dayEvents = state.events.filter(ev => isEventOnDate(ev, dISO) && !ev.allDay);
        const dayAllDay = state.events.filter(ev => isEventOnDate(ev, dISO) && ev.allDay);

        // 終日イベントは上部に表示
        dayAllDay.forEach(ev => {
            const card = document.createElement("div");
            card.className = "week-event-card";
            card.style.backgroundColor = ev.color || "#0EA5E9";
            card.style.top = "2px";
            card.style.height = "16px";
            card.style.left = "2px";
            card.style.right = "2px";
            card.style.zIndex = "3";
            card.innerHTML = `<span class="ev-title">📌 ${ev.title}</span>`;
            card.onclick = (e) => { e.stopPropagation(); openEditEvent(ev.id); };
            colDiv.appendChild(card);
        });

        // 時間付きイベントの重なり計算（グリーディー列分割）
        // 1. 開始時刻順にソート
        const sorted = [...dayEvents].sort((a, b) => {
            const ta = a.start ? new Date(a.start).getTime() : 0;
            const tb = b.start ? new Date(b.start).getTime() : 0;
            return ta - tb;
        });

        // 2. 重なりグループを検出して列を割り当てる
        const columns = []; // columns[i] = last end time of that sub-column
        const assigned = sorted.map(ev => {
            const start = ev.start ? new Date(ev.start) : new Date(d);
            const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 60 * 60 * 1000);
            const startMin = (start.getHours() * 60 + start.getMinutes());
            const endMin = (end.getHours() * 60 + end.getMinutes()) || startMin + 60;
            let col = columns.findIndex(lastEnd => lastEnd <= startMin);
            if (col === -1) { columns.push(endMin); col = columns.length - 1; }
            else { columns[col] = endMin; }
            return { ev, startMin, endMin, col };
        });

        const numCols = columns.length || 1;

        assigned.forEach(({ ev, startMin, endMin, col }) => {
            const topPx = startMin * (HOUR_PX / 60);
            const heightPx = Math.max(18, (endMin - startMin) * (HOUR_PX / 60));
            const widthFrac = 1 / numCols;
            const leftPct = col * widthFrac * 100;
            const widthPct = widthFrac * 100;

            const card = document.createElement("div");
            card.className = "week-event-card";
            card.style.backgroundColor = ev.color || "#0EA5E9";
            card.style.top = `${topPx}px`;
            card.style.height = `${heightPx}px`;
            card.style.left = `calc(${leftPct}% + 2px)`;
            card.style.width = `calc(${widthPct}% - 4px)`;
            card.style.right = "auto";

            const startH = Math.floor(startMin / 60).toString().padStart(2, "0");
            const startM = (startMin % 60).toString().padStart(2, "0");
            const endH = Math.floor(endMin / 60).toString().padStart(2, "0");
            const endM = (endMin % 60).toString().padStart(2, "0");
            const timeStr = `${startH}:${startM}〜${endH}:${endM}`;

            card.innerHTML = `<span class="ev-title">${ev.title}</span><span class="ev-time">${timeStr}</span>`;
            card.onclick = (e) => { e.stopPropagation(); openEditEvent(ev.id); };
            colDiv.appendChild(card);
        });

        weekCols.appendChild(colDiv);
    });

    timeGrid.appendChild(weekCols);

    // ==== 現在時刻インジケーター ====
    if (cells.some(d => formatDateISO(d) === todayISO)) {
        const now = today;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const nowTop = nowMin * (HOUR_PX / 60);

        // 今日の列インデックス
        const todayColIdx = cells.findIndex(d => formatDateISO(d) === todayISO);
        if (todayColIdx >= 0) {
            // インジケーターを weekCols の絶対ポジションで出すため
            // すべての列をまたぐ幅で表示する
            const indicator = document.createElement("div");
            indicator.className = "week-time-indicator";
            indicator.style.top = `${nowTop}px`;
            // 全幅にまたがせる
            indicator.style.left = "0";
            indicator.style.right = "0";
            weekCols.style.position = "relative";
            weekCols.appendChild(indicator);
        }
    }

    scrollBody.appendChild(timeGrid);
    wrapper.appendChild(scrollBody);
    grid.appendChild(wrapper);

    // 現在時刻付近にスクロール
    const now = new Date();
    const scrollTarget = Math.max(0, (now.getHours() - 1) * HOUR_PX);
    requestAnimationFrame(() => { scrollBody.scrollTop = scrollTarget; });
}


function renderCalendarCells(cells, grid, isMonth) {
    const today = new Date();
    const todayISO = formatDateISO(today);

    cells.forEach(c => {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        if (isMonth && !c.currentMonth) cell.classList.add("other-month");

        // 週ビューのセルは高さを大きく
        if (!isMonth) {
            cell.style.minHeight = "120px";
        }

        const dateISO = formatDateISO(c.date);

        // 今日ハイライト
        if (dateISO === todayISO) {
            cell.classList.add("today");
        }

        // 土日の色分け
        const dow = c.date.getDay();
        if (dow === 6) cell.classList.add("sat-day");
        if (dow === 0) cell.classList.add("sun-day");

        // 日付番号
        const dayNumEl = document.createElement("span");
        dayNumEl.className = "day-number";
        dayNumEl.innerText = c.date.getDate();
        cell.appendChild(dayNumEl);

        // イベントコンテナ
        const eventsContainer = document.createElement("div");
        eventsContainer.className = "calendar-events-container";

        // データ取得
        const dayEvents = state.events.filter(ev => isEventOnDate(ev, dateISO));
        const dayTodos = state.todos.filter(t => t.deadline.split("T")[0] === dateISO && !t.completed);
        const dayWeekly = c.currentMonth ? state.weeklySchedule.filter(w => w.day === dow) : [];

        // 時間順にソートした予定リストを構築
        const allItems = [];

        dayWeekly.forEach(w => {
            let sortVal = 0;
            let timePrefix = '';
            if (w.timeblock === 'morning') { sortVal = 6; timePrefix = '🌅'; }
            else if (w.timeblock === 'afternoon') { sortVal = 12; timePrefix = '☀'; }
            else if (w.timeblock === 'evening') { sortVal = 18; timePrefix = '🌙'; }
            else {
                const p = (w.startTime || '09:00').split(':');
                sortVal = parseInt(p[0]) + parseInt(p[1]) / 60;
                timePrefix = w.startTime;
            }
            allItems.push({ type: 'weekly', color: w.color, label: `${timePrefix} ${w.title}`, sortVal });
        });

        dayEvents.forEach(ev => {
            let sortVal = 0;
            let timePrefix = '';
            if (ev.allDay) {
                timePrefix = '📌';
                sortVal = 0;
            } else {
                const t = (ev.start.split('T')[1] || '00:00').slice(0, 5);
                const p = t.split(':');
                sortVal = parseInt(p[0]) + parseInt(p[1]) / 60;
                timePrefix = t;
            }
            allItems.push({ type: 'event', color: ev.color, label: `${timePrefix} ${ev.title}`, sortVal });
        });

        dayTodos.forEach(t => {
            const t2 = (t.deadline.split('T')[1] || '18:00').slice(0, 5);
            const p = t2.split(':');
            const sortVal = parseInt(p[0]) + parseInt(p[1]) / 60;
            allItems.push({ type: 'todo', color: '#EF4444', label: `⚠ ${t.title}`, sortVal });
        });

        // 時間順ソート
        allItems.sort((a, b) => a.sortVal - b.sortVal);

        const MAX_VISIBLE = isMonth ? 3 : 5;
        allItems.slice(0, MAX_VISIBLE).forEach(item => {
            const badge = document.createElement("div");
            badge.className = "calendar-event-dot";
            badge.style.backgroundColor = item.color;
            badge.textContent = item.label;
            // mini dot for extra small fallback (hidden via CSS on mobile now)
            const miniDot = document.createElement("span");
            miniDot.className = "calendar-event-mini-dot";
            miniDot.style.backgroundColor = item.color;
            eventsContainer.appendChild(badge);
            eventsContainer.appendChild(miniDot);
        });

        const remaining = allItems.length - MAX_VISIBLE;
        if (remaining > 0) {
            const more = document.createElement("div");
            more.className = "calendar-event-dot calendar-more";
            more.style.backgroundColor = "transparent";
            more.style.color = "var(--text-secondary)";
            more.textContent = `+${remaining}件`;
            eventsContainer.appendChild(more);
        }

        cell.appendChild(eventsContainer);

        // クリックイベント → 日付詳細モーダル
        cell.onclick = () => openDayDetails(c.date, dayEvents, dayTodos, dayWeekly);

        grid.appendChild(cell);
    });
}

// --- 5. Todoリスト画面の描画 ---
let currentTodoFilter = 'all';     // 'all', 'active', 'completed'
let currentTagFilter = 'all';      // 'all', 'work', 'private', 'shopping', 'other'
let currentTodoSort = 'deadline-asc'; // 'deadline-asc', 'deadline-desc', 'priority-desc'

function renderTodoList() {
    const container = document.getElementById("todo-list-container");
    container.innerHTML = "";

    // フィルタリング
    let filtered = state.todos;

    // ① 状態フィルター
    if (currentTodoFilter === 'active') {
        filtered = filtered.filter(t => !t.completed);
    } else if (currentTodoFilter === 'completed') {
        filtered = filtered.filter(t => t.completed);
    }

    // ② カテゴリタグフィルター
    if (currentTagFilter !== 'all') {
        filtered = filtered.filter(t => t.category === currentTagFilter);
    }

    // ソート (未完了優先、その後は指定された順)
    filtered.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        if (currentTodoSort === 'deadline-desc') {
            return new Date(b.deadline) - new Date(a.deadline);
        } else if (currentTodoSort === 'priority-desc') {
            const priorityVal = { high: 3, medium: 2, low: 1 };
            const aVal = priorityVal[a.priority] || 2;
            const bVal = priorityVal[b.priority] || 2;
            if (bVal !== aVal) {
                return bVal - aVal;
            }
            return new Date(a.deadline) - new Date(b.deadline);
        } else {
            return new Date(a.deadline) - new Date(b.deadline);
        }
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:40px; color:var(--text-secondary);">該当するタスクはありません。</div>`;
        return;
    }

    filtered.forEach(todo => {
        const countdownInfo = getCountdown(todo.deadline);
        const countdownClass = todo.completed ? "safe" : (countdownInfo.days <= 1 ? "danger" : (countdownInfo.days <= 3 ? "warning" : "safe"));

        const card = document.createElement("div");
        card.className = `todo-item-card ${todo.completed ? 'completed' : ''}`;
        card.style.cursor = "pointer";
        card.onclick = (e) => {
            if (!e.target.closest('.todo-checkbox') && !e.target.closest('.btn-item-delete')) {
                openEditTodo(todo.id, e);
            }
        };

        const cat = CATEGORIES[todo.category];
        const catBadge = cat ? `
            <span class="tag-badge ${todo.category}" style="margin-right: 6px;" title="${cat.label}">
                ${cat.icon}
            </span>
        ` : '';

        let balancerBadge = '';
        if (!todo.completed) {
            const freeTime = calculateFreeTimeRemaining(todo.deadline);
            const balancerClass = freeTime < 3 ? 'danger' : '';
            const balancerIcon = freeTime < 3 ? '🚨' : '🕒';
            balancerBadge = `<span class="balancer-badge ${balancerClass}">${balancerIcon} 実質残り: ${freeTime}h</span>`;
        }

        card.innerHTML = `
            <div class="todo-left">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="toggleTodoCompleted('${todo.id}', event)"></div>
                <div class="todo-info-group">
                    <div class="todo-main-title">${todo.title}</div>
                    <div class="todo-meta-info" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        ${balancerBadge}
                        ${catBadge}
                        <span>📅 締切: ${formatDate(todo.deadline)}</span>
                        <span class="priority-badge ${todo.priority}">${todo.priority === 'high' ? '高' : (todo.priority === 'medium' ? '中' : '低')}</span>
                    </div>
                    ${todo.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">📝 ${todo.notes}</div>` : ''}
                </div>
            </div>
            <div class="todo-right">
                <div class="todo-countdown ${countdownClass}">${todo.completed ? '完了' : countdownInfo.text}</div>
                <button class="btn-item-delete" style="margin-top:4px;" onclick="deleteTodo('${todo.id}', event)" title="削除">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- 6. 設定・画像管理画面の描画 ---
function renderSettings() {
    const darkThemeToggle = document.getElementById("setting-dark-theme");
    if (darkThemeToggle) {
        darkThemeToggle.checked = (state.settings.theme === 'dark');
    }
    document.getElementById("setting-saturday").checked = state.settings.saturday;
    document.getElementById("setting-monday-start").checked = state.settings.mondayStart;

    const imgContainer = document.getElementById("image-preview-container");
    const imgPreview = document.getElementById("timetable-image-preview");

    if (state.timetableImage) {
        imgPreview.src = state.timetableImage;
        imgContainer.style.display = "block";
    } else {
        imgContainer.style.display = "none";
    }
}

// ==========================================
// 4. イベントハンドラー & 各種アクション
// ==========================================

function switchPage(pageId, title) {
    // 全ページ非表示
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    // 対象ページ表示
    const targetPage = document.getElementById("page-" + pageId);
    if (targetPage) targetPage.classList.add("active");

    // ヘッダータイトル更新
    const headerTitle = document.getElementById("header-title");
    if (headerTitle) headerTitle.innerText = title;

    // ヘッダーボタンのアクティブ更新
    const dashBtn = document.getElementById("header-btn-dashboard");
    const setBtn = document.getElementById("header-btn-settings");
    if (dashBtn) dashBtn.classList.remove("active");
    if (setBtn) setBtn.classList.remove("active");

    if (pageId === "dashboard" && dashBtn) dashBtn.classList.add("active");
    if (pageId === "settings" && setBtn) setBtn.classList.add("active");

    // ボトムナビボタンのアクティブ更新
    document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
    const navBtn = document.getElementById("nav-" + pageId);
    if (navBtn) navBtn.classList.add("active");

    // FAB制御 (合同・設定では非表示)
    const fab = document.getElementById("fab");
    if (fab) {
        if (pageId === "split" || pageId === "settings") {
            fab.style.display = "none";
        } else {
            fab.style.display = "flex";
        }
    }

    // 各ページ描画の更新
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'split') {
        splitDateOffset = 0; // 合同タブを開くときは常に今日から
        renderSplitView();
    }
    if (pageId === 'calendar') renderCalendar();
    if (pageId === 'todo') renderTodoList();
    if (pageId === 'settings') renderSettings();
}

// カレンダービュー切り替え（月/週）
let currentCalendarView = 'month';
function switchCalendarView(view) {
    currentCalendarView = view;
    const monthBtn = document.getElementById('btn-view-month');
    const weekBtn = document.getElementById('btn-view-week');
    if (monthBtn && weekBtn) {
        if (view === 'month') {
            monthBtn.classList.add('active');
            weekBtn.classList.remove('active');
        } else {
            weekBtn.classList.add('active');
            monthBtn.classList.remove('active');
        }
    }
    renderCalendar();
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

// カスタム確認ダイアログ（confirm()の代替）
function showConfirmDialog(message, onConfirm) {
    const overlay = document.getElementById("modal-confirm");
    const msgEl = document.getElementById("confirm-dialog-message");
    const okBtn = document.getElementById("confirm-dialog-ok");
    const cancelBtn = document.getElementById("confirm-dialog-cancel");

    if (!overlay || !msgEl || !okBtn || !cancelBtn) return;

    msgEl.innerText = message;
    overlay.classList.add("active");

    // 既存のリスナーを一度削除（重複防止）
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener("click", () => {
        overlay.classList.remove("active");
        onConfirm();
    });
    newCancelBtn.addEventListener("click", () => {
        overlay.classList.remove("active");
    });
}

// カラーピッカー初期化
function initColorPickers() {
    const wPicker = document.getElementById("weekly-color-picker");
    const ePicker = document.getElementById("event-color-picker");

    wPicker.innerHTML = "";
    ePicker.innerHTML = "";

    THEME_COLORS.forEach((color, idx) => {
        // 習慣用
        const wOpt = document.createElement("div");
        wOpt.className = `color-option ${idx === 0 ? 'selected' : ''}`;
        wOpt.style.backgroundColor = color;
        wOpt.onclick = () => {
            wPicker.querySelectorAll(".color-option").forEach(o => o.classList.remove("selected"));
            wOpt.classList.add("selected");
            document.getElementById("weekly-color").value = color;
        };
        wPicker.appendChild(wOpt);

        // カレンダー用
        const eOpt = document.createElement("div");
        eOpt.className = `color-option ${idx === 1 ? 'selected' : ''}`;
        eOpt.style.backgroundColor = color;
        eOpt.onclick = () => {
            ePicker.querySelectorAll(".color-option").forEach(o => o.classList.remove("selected"));
            eOpt.classList.add("selected");
            document.getElementById("event-color").value = color;
        };
        ePicker.appendChild(eOpt);
    });
}

// --- 習慣・週間スケジュール処理 ---

function toggleWeeklyTimeInput() {
    const select = document.getElementById("weekly-timeblock-select");
    const timeRow = document.getElementById("weekly-time-input-row");

    if (select.value === 'specific') {
        timeRow.style.display = "flex";
    } else {
        timeRow.style.display = "none";
    }
}

function toggleEventAllDay() {
    const isAllDay = document.getElementById("event-allday").checked;
    const startInput = document.getElementById("event-start");
    const endInput = document.getElementById("event-end");
    const startLabel = document.getElementById("lbl-event-start");
    const endLabel = document.getElementById("lbl-event-end");

    const startVal = startInput.value;
    const endVal = endInput.value;

    if (isAllDay) {
        startInput.type = "date";
        endInput.type = "date";
        if (startLabel) startLabel.innerText = "開始日 *";
        if (endLabel) endLabel.innerText = "終了日";

        if (startVal && startVal.includes("T")) startInput.value = startVal.split("T")[0];
        if (endVal && endVal.includes("T")) endInput.value = endVal.split("T")[0];
    } else {
        startInput.type = "datetime-local";
        endInput.type = "datetime-local";
        if (startLabel) startLabel.innerText = "開始日時 *";
        if (endLabel) endLabel.innerText = "終了日時";

        if (startVal && !startVal.includes("T")) startInput.value = startVal + "T10:00";
        if (endVal && !endVal.includes("T")) endInput.value = endVal + "T11:00";
    }
}

function isEventOnDate(ev, dateStr) {
    const evStartStr = ev.start.split("T")[0];

    if (!ev.recurrence || ev.recurrence === 'none') {
        if (ev.end) {
            const evEndStr = ev.end.split("T")[0];
            return dateStr >= evStartStr && dateStr <= evEndStr;
        }
        return evStartStr === dateStr;
    }

    if (dateStr < evStartStr) return false;

    const targetDate = new Date(dateStr);
    const startDate = new Date(evStartStr);

    if (ev.recurrence === 'daily') {
        return true;
    }

    if (ev.recurrence === 'weekly') {
        return targetDate.getDay() === startDate.getDay();
    }

    if (ev.recurrence === 'monthly') {
        return targetDate.getDate() === startDate.getDate();
    }

    return false;
}

function openAddWeeklyEvent(day = 1) {
    document.getElementById("weekly-modal-title").innerText = "習慣・週間予定の追加";
    document.getElementById("form-weekly").reset();
    document.getElementById("weekly-id").value = "";

    document.getElementById("weekly-day-select").value = day;
    document.getElementById("weekly-time-input-row").style.display = "none";

    // カラーリセット
    document.getElementById("weekly-color").value = THEME_COLORS[0];
    const picker = document.getElementById("weekly-color-picker");
    picker.querySelectorAll(".color-option").forEach(o => o.classList.remove("selected"));
    picker.children[0].classList.add("selected");

    // 土日の表示切り替え
    document.getElementById("weekly-opt-sat").style.display = state.settings.saturday ? "block" : "none";
    document.getElementById("weekly-opt-sun").style.display = state.settings.saturday ? "block" : "none";

    openModal("modal-weekly-edit");
}

function openEditWeeklyEvent(id) {
    const item = state.weeklySchedule.find(w => w.id === id);
    if (!item) return;

    document.getElementById("weekly-modal-title").innerText = "習慣・週間予定の編集";
    document.getElementById("weekly-id").value = item.id;
    document.getElementById("weekly-title").value = item.title;
    document.getElementById("weekly-day-select").value = item.day;
    document.getElementById("weekly-timeblock-select").value = item.timeblock;
    document.getElementById("weekly-category").value = item.category;
    document.getElementById("weekly-notes").value = item.notes || "";

    if (item.timeblock === 'specific') {
        document.getElementById("weekly-time-input-row").style.display = "flex";
        document.getElementById("weekly-start-time").value = item.startTime || "09:00";
        document.getElementById("weekly-end-time").value = item.endTime || "10:00";
    } else {
        document.getElementById("weekly-time-input-row").style.display = "none";
    }

    // カラー
    document.getElementById("weekly-color").value = item.color;
    const picker = document.getElementById("weekly-color-picker");
    picker.querySelectorAll(".color-option").forEach(o => {
        const bg = o.style.backgroundColor;
        if (rgbToHex(bg) === item.color.toLowerCase() || bg === item.color) {
            picker.querySelectorAll(".color-option").forEach(c => c.classList.remove("selected"));
            o.classList.add("selected");
        }
    });

    openModal("modal-weekly-edit");
}

function deleteWeeklySchedule(id, event) {
    if (event) event.stopPropagation();
    showConfirmDialog("この予定を削除しますか？", () => {
        state.weeklySchedule = state.weeklySchedule.filter(w => w.id !== id);
        saveData();
        renderWeeklyPlanner();
        renderDashboard();
        renderSplitView();
        renderCalendar();
    });
}

// --- Todo処理 ---

function openAddTodo(dateStr = "") {
    document.getElementById("todo-modal-title").innerText = "Todo・タスクの追加";
    document.getElementById("form-todo").reset();
    document.getElementById("todo-id").value = "";
    document.getElementById("todo-recurrence").value = "none";

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);

    if (dateStr) {
        const d = new Date(dateStr);
        d.setHours(18, 0, 0, 0);
        document.getElementById("todo-deadline").value = formatDateTimeLocal(d);
    } else {
        document.getElementById("todo-deadline").value = formatDateTimeLocal(tomorrow);
    }

    openModal("modal-todo-edit");
}

function openEditTodo(id, event) {
    if (event) event.stopPropagation();
    const todo = state.todos.find(t => t.id === id);
    if (!todo) return;

    document.getElementById("todo-modal-title").innerText = "Todo・タスクの編集";
    document.getElementById("todo-id").value = todo.id;
    document.getElementById("todo-title").value = todo.title;
    document.getElementById("todo-category").value = todo.category;
    document.getElementById("todo-priority").value = todo.priority;
    document.getElementById("todo-deadline").value = todo.deadline;
    document.getElementById("todo-recurrence").value = todo.recurrence || "none";
    document.getElementById("todo-notes").value = todo.notes || "";

    openModal("modal-todo-edit");
}

function deleteTodo(id, event) {
    if (event) event.stopPropagation();
    showConfirmDialog("このTodoを削除しますか？", () => {
        state.todos = state.todos.filter(t => t.id !== id);
        saveData();
        renderTodoList();
        renderDashboard();
        renderSplitView();
        renderCalendar();
    });
}

function toggleTodoCompleted(id, event) {
    if (event) event.stopPropagation();
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        const wasCompleted = todo.completed;
        todo.completed = !todo.completed;

        // 完了(未完了から完了へ)かつ繰り返し設定が'none'以外の場合、次の期日のTodoを自動生成
        if (!wasCompleted && todo.completed && todo.recurrence && todo.recurrence !== 'none') {
            const currentDeadline = new Date(todo.deadline);
            let nextDeadline = new Date(currentDeadline);

            if (todo.recurrence === 'daily') {
                nextDeadline.setDate(currentDeadline.getDate() + 1);
            } else if (todo.recurrence === 'weekly') {
                nextDeadline.setDate(currentDeadline.getDate() + 7);
            } else if (todo.recurrence === 'monthly') {
                nextDeadline.setMonth(currentDeadline.getMonth() + 1);
            }

            const nextTodo = {
                id: "todo-" + Date.now(),
                title: todo.title,
                category: todo.category,
                priority: todo.priority,
                deadline: formatDateTimeLocal(nextDeadline),
                notes: todo.notes || "",
                recurrence: todo.recurrence,
                completed: false
            };
            state.todos.push(nextTodo);
        }

        saveData();
        renderTodoList();
        renderDashboard();
        renderSplitView();
        renderCalendar();
    }
}

// --- カレンダー予定処理 ---

function openAddEvent(dateStr = "") {
    document.getElementById("event-modal-title").innerText = "予定の追加";
    document.getElementById("form-event").reset();
    document.getElementById("event-id").value = "";
    document.getElementById("event-allday").checked = false;
    document.getElementById("event-recurrence").value = "none";
    document.getElementById("event-location").value = "";
    document.getElementById("event-travel-time").value = "";
    toggleEventAllDay();

    const now = new Date();
    now.setMinutes(0, 0, 0);

    if (dateStr) {
        const d = new Date(dateStr);
        d.setHours(10, 0, 0, 0);
        document.getElementById("event-start").value = formatDateISO(d);
        d.setHours(11, 0, 0, 0);
        document.getElementById("event-end").value = formatDateISO(d);
    } else {
        document.getElementById("event-start").value = formatDateTimeLocal(now);
        now.setHours(now.getHours() + 1);
        document.getElementById("event-end").value = formatDateTimeLocal(now);
    }

    document.getElementById("event-color").value = THEME_COLORS[1];
    const picker = document.getElementById("event-color-picker");
    picker.querySelectorAll(".color-option").forEach(o => o.classList.remove("selected"));
    picker.children[1].classList.add("selected");

    openModal("modal-event-edit");
}

function openEditEvent(id) {
    closeModal("modal-day-details");
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;

    document.getElementById("event-modal-title").innerText = "予定の編集";
    document.getElementById("event-id").value = ev.id;
    document.getElementById("event-title").value = ev.title;

    document.getElementById("event-allday").checked = !!ev.allDay;
    toggleEventAllDay();

    document.getElementById("event-start").value = ev.start;
    document.getElementById("event-end").value = ev.end || "";
    document.getElementById("event-recurrence").value = ev.recurrence || "none";
    document.getElementById("event-location").value = ev.location || "";
    document.getElementById("event-travel-time").value = ev.travelTime || "";
    document.getElementById("event-notes").value = ev.notes || "";

    // 色
    document.getElementById("event-color").value = ev.color;
    const picker = document.getElementById("event-color-picker");
    picker.querySelectorAll(".color-option").forEach(o => {
        const bg = o.style.backgroundColor;
        if (rgbToHex(bg) === ev.color.toLowerCase() || bg === ev.color) {
            picker.querySelectorAll(".color-option").forEach(c => c.classList.remove("selected"));
            o.classList.add("selected");
        }
    });

    openModal("modal-event-edit");
}

function deleteEvent(id) {
    if (confirm("この予定を削除しますか？")) {
        state.events = state.events.filter(e => e.id !== id);
        saveData();
        closeModal("modal-day-details");
        renderCalendar();
        renderDashboard();
    }
}

// カレンダー日付詳細モーダル
let activeDateForAdd = "";
function openDayDetails(date, dayEvents, dayTodos, dayWeekly) {
    activeDateForAdd = formatDateISO(date);
    document.getElementById("day-details-title").innerText = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${DAYS[date.getDay()]}) の予定`;

    const listContainer = document.getElementById("day-events-list");
    listContainer.innerHTML = "";

    let hasItems = false;

    // ① 週間スケジュール
    if (dayWeekly.length > 0) {
        hasItems = true;
        dayWeekly.forEach(w => {
            const item = document.createElement("div");
            item.style.padding = "8px 12px";
            item.style.borderRadius = "8px";
            item.style.backgroundColor = "var(--bg-primary)";
            item.style.borderLeft = `4px solid ${w.color}`;

            let timeStr = "";
            if (w.timeblock === 'morning') timeStr = "朝";
            else if (w.timeblock === 'afternoon') timeStr = "昼";
            else if (w.timeblock === 'evening') timeStr = "夜";
            else timeStr = `${w.startTime}〜${w.endTime}`;

            item.innerHTML = `
                <div style="font-weight:600; font-size:0.85rem;">🔄 週間定期: ${w.title} (${timeStr})</div>
                ${w.notes ? `<div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">${w.notes}</div>` : ''}
            `;
            listContainer.appendChild(item);
        });
    }

    // ② 単発イベント
    if (dayEvents.length > 0) {
        hasItems = true;
        dayEvents.forEach(ev => {
            const item = document.createElement("div");
            item.style.padding = "8px 12px";
            item.style.borderRadius = "8px";
            item.style.backgroundColor = "var(--bg-primary)";
            item.style.borderLeft = `4px solid ${ev.color}`;
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";

            let timeText = "";
            if (ev.allDay) {
                timeText = " (🕒 終日)";
            } else {
                const startT = ev.start.split("T")[1] || "";
                const endT = ev.end ? ev.end.split("T")[1] : "";
                timeText = startT ? ` (🕒 ${startT}${endT ? '〜' + endT : ''})` : '';
            }

            let extraText = "";
            if (ev.location) extraText += `📍 場所: ${ev.location} `;
            if (ev.travelTime) extraText += `🚗 移動: ${ev.travelTime}分 `;
            if (ev.recurrence && ev.recurrence !== 'none') {
                const recurLabels = { daily: '毎日', weekly: '毎週', monthly: '毎月' };
                extraText += `🔄 ${recurLabels[ev.recurrence]} `;
            }

            item.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:600; font-size:0.85rem;">📌 予定: ${ev.title}${timeText}</div>
                    ${extraText ? `<div style="font-size:0.75rem; color:var(--primary); font-weight:500; margin-top:2px;">${extraText}</div>` : ''}
                    ${ev.notes ? `<div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">${ev.notes}</div>` : ''}
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="btn-reschedule" onclick="rescheduleEvent('${ev.id}', 'event'); closeModal('modal-day-details');" title="翌日以降の空き時間にリスケ">🔄</button>
                    <button class="todo-delete-btn" onclick="openEditEvent('${ev.id}')" title="編集">✏️</button>
                    <button class="todo-delete-btn" onclick="deleteEvent('${ev.id}')" title="削除">🗑️</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    // ③ 締め切り (Todo)
    if (dayTodos.length > 0) {
        hasItems = true;
        dayTodos.forEach(todo => {
            const item = document.createElement("div");
            item.style.padding = "8px 12px";
            item.style.borderRadius = "8px";
            item.style.backgroundColor = "var(--bg-primary)";
            item.style.borderLeft = "4px solid var(--accent-red)";
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";

            item.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size:0.85rem; color:var(--accent-red);">⚠️ タスク締切: ${todo.title}</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">
                        期日: ${todo.deadline.split("T")[1] || "終日"} | 優先度: ${todo.priority}
                    </div>
                </div>
                <button class="btn btn-secondary btn-adj" style="font-size:0.7rem; width:50px;" onclick="closeModal('modal-day-details'); switchPage('todo', 'Todoリスト');">移動</button>
            `;
            listContainer.appendChild(item);
        });
    }

    if (!hasItems) {
        listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.85rem;">予定はありません。</div>`;
    }

    openModal("modal-day-details");
}

// --- 新規登録モーダル呼び出しフロー用 ---

function openAddWeeklyEventFromSelector() {
    closeModal("modal-add-selector");
    openAddWeeklyEvent(1);
}

function openAddTodoFromSelector() {
    closeModal("modal-add-selector");
    openAddTodo();
}

function openAddEventFromSelector() {
    closeModal("modal-add-selector");
    openAddEvent();
}

// ==========================================
// 5. フォームイベント初期化・イベントリスナー
// ==========================================

function initEventListeners() {
    // 画面外クリック時にポップアップメニューを閉じる
    document.addEventListener("click", closeAllMenus);

    // FABクリック ➡ 各タブに応じた追加画面へ直接遷移、または選択表示
    document.getElementById("fab").addEventListener("click", () => {
        const activePage = document.querySelector(".page.active");
        if (activePage) {
            const pageId = activePage.id;
            if (pageId === "page-calendar") {
                openAddEvent();
            } else if (pageId === "page-todo") {
                openAddTodo();
            } else {
                openModal("modal-add-selector");
            }
        } else {
            openModal("modal-add-selector");
        }
    });

    // 1. 習慣予定フォーム Submit
    document.getElementById("form-weekly").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("weekly-id").value;
        const newWeekly = {
            id: id || "w-" + Date.now(),
            title: document.getElementById("weekly-title").value,
            day: parseInt(document.getElementById("weekly-day-select").value),
            timeblock: document.getElementById("weekly-timeblock-select").value,
            startTime: document.getElementById("weekly-start-time").value,
            endTime: document.getElementById("weekly-end-time").value,
            category: document.getElementById("weekly-category").value,
            color: document.getElementById("weekly-color").value,
            notes: document.getElementById("weekly-notes").value
        };

        if (id) {
            const idx = state.weeklySchedule.findIndex(w => w.id === id);
            if (idx !== -1) state.weeklySchedule[idx] = newWeekly;
        } else {
            state.weeklySchedule.push(newWeekly);
        }

        saveData();
        closeModal("modal-weekly-edit");
        renderWeeklyPlanner();
        renderDashboard();
        renderSplitView();
        renderCalendar();
    });

    // 2. Todoフォーム Submit
    document.getElementById("form-todo").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("todo-id").value;
        const newTodo = {
            id: id || "todo-" + Date.now(),
            title: document.getElementById("todo-title").value,
            category: document.getElementById("todo-category").value,
            priority: document.getElementById("todo-priority").value,
            deadline: document.getElementById("todo-deadline").value,
            notes: document.getElementById("todo-notes").value,
            recurrence: document.getElementById("todo-recurrence").value,
            completed: id ? state.todos.find(t => t.id === id).completed : false
        };

        if (id) {
            const idx = state.todos.findIndex(t => t.id === id);
            if (idx !== -1) state.todos[idx] = newTodo;
        } else {
            state.todos.push(newTodo);
        }

        saveData();
        closeModal("modal-todo-edit");
        renderTodoList();
        renderDashboard();
        renderSplitView();
        renderCalendar();
    });

    // 3. カレンダー単発予定フォーム Submit
    document.getElementById("form-event").addEventListener("submit", (e) => {
        e.preventDefault();

        const id = document.getElementById("event-id").value;
        const travelVal = document.getElementById("event-travel-time").value;
        const newEvent = {
            id: id || "ev-" + Date.now(),
            title: document.getElementById("event-title").value,
            start: document.getElementById("event-start").value,
            end: document.getElementById("event-end").value,
            color: document.getElementById("event-color").value,
            notes: document.getElementById("event-notes").value,
            allDay: document.getElementById("event-allday").checked,
            recurrence: document.getElementById("event-recurrence").value,
            location: document.getElementById("event-location").value,
            travelTime: travelVal ? parseInt(travelVal) : 0
        };

        if (id) {
            const idx = state.events.findIndex(ev => ev.id === id);
            if (idx !== -1) state.events[idx] = newEvent;
        } else {
            state.events.push(newEvent);
        }

        saveData();
        closeModal("modal-event-edit");
        renderCalendar();
        renderDashboard();
    });

    // 日にち詳細モーダルからの予定追加紐付け
    document.getElementById("btn-add-event-for-day").onclick = () => {
        closeModal("modal-day-details");
        openAddEvent(activeDateForAdd);
    };

    // カレンダー前後移動 ・ 今日へ戻る
    document.getElementById("cal-prev").onclick = () => {
        if (currentCalendarView === 'week') {
            currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
        } else {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        }
        renderCalendar();
    };
    document.getElementById("cal-next").onclick = () => {
        if (currentCalendarView === 'week') {
            currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
        } else {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        }
        renderCalendar();
    };
    document.getElementById("cal-today").onclick = () => {
        currentCalendarDate = new Date();
        renderCalendar();
    };

    // Todo状態フィルターボタン
    document.getElementById("todo-filter-all").onclick = () => setTodoFilter('all');
    document.getElementById("todo-filter-active").onclick = () => setTodoFilter('active');
    document.getElementById("todo-filter-completed").onclick = () => setTodoFilter('completed');

    // Todo並び替えセレクトボックス
    const sortSelect = document.getElementById("todo-sort-select");
    if (sortSelect) {
        sortSelect.onchange = (e) => {
            currentTodoSort = e.target.value;
            renderTodoList();
        };
    }

    // Todoカテゴリタグフィルターボタン
    document.getElementById("tag-filter-all").onclick = () => setTagFilter('all');
    document.getElementById("tag-filter-work").onclick = () => setTagFilter('work');
    document.getElementById("tag-filter-private").onclick = () => setTagFilter('private');
    document.getElementById("tag-filter-shopping").onclick = () => setTagFilter('shopping');
    document.getElementById("tag-filter-other").onclick = () => setTagFilter('other');

    // 設定スイッチ
    // ダークモード切り替え
    const darkThemeToggle = document.getElementById("setting-dark-theme");
    if (darkThemeToggle) {
        darkThemeToggle.onchange = (e) => {
            state.settings.theme = e.target.checked ? 'dark' : 'light';
            saveData();
            initTheme();
        };
    }

    document.getElementById("setting-saturday").onchange = (e) => {
        state.settings.saturday = e.target.checked;
        saveData();
        renderWeeklyPlanner();
        renderCalendar();
        renderSplitView();
    };

    document.getElementById("setting-monday-start").onchange = (e) => {
        state.settings.mondayStart = e.target.checked;
        saveData();
        renderCalendar();
        renderWeeklyPlanner();
    };

    // 全リセット
    document.getElementById("btn-reset-data").onclick = () => {
        if (confirm("警告: すべての予定、Todo、画像が完全に削除されます。初期化しますか？")) {
            localStorage.removeItem("campus_organizer_data");
            location.reload();
        }
    };

    // 画像アップロード・カメラ連携
    const uploadArea = document.getElementById("image-upload-area");
    const imageInput = document.getElementById("timetable-image-input");

    uploadArea.onclick = () => imageInput.click();

    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            compressImage(event.target.result, 800, 0.6, (compressedDataUrl) => {
                state.timetableImage = compressedDataUrl;
                saveData();
                renderSettings();
            });
        };
        reader.readAsDataURL(file);
    };

    // 画像削除
    document.getElementById("image-remove-btn").onclick = () => {
        if (confirm("登録した画像を削除しますか？")) {
            state.timetableImage = "";
            saveData();
            renderSettings();
        }
    };

    // === 見比べ画面のレジライザー(仕切り線)ドラッグ処理 ===
    const splitContainer = document.getElementById("split-container");
    const splitLeft = document.getElementById("split-left");
    const splitDivider = document.getElementById("split-divider");

    let isResizing = false;

    const startResize = (e) => {
        isResizing = true;
        splitDivider.classList.add("active");
        document.body.classList.add("resizing-active");
    };

    const resize = (e) => {
        if (!isResizing) return;

        // ドラッグ中は画面スクロール等のデフォルト挙動を防止
        if (e.cancelable) e.preventDefault();

        const containerRect = splitContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            // 上下分割: 高さ比率を計算
            const percentage = ((clientY - containerRect.top) / containerRect.height) * 100;
            const constrained = Math.max(15, Math.min(85, percentage));
            splitLeft.style.height = `calc(${constrained}% - 8px)`;
            splitLeft.style.width = ""; // 横幅指定をクリア
        } else {
            // 左右分割: 幅比率を計算
            const percentage = ((clientX - containerRect.left) / containerRect.width) * 100;
            const constrained = Math.max(15, Math.min(85, percentage));
            splitLeft.style.width = `calc(${constrained}% - 8px)`;
            splitLeft.style.height = ""; // 高さ指定をクリア
        }
    };

    const stopResize = () => {
        if (isResizing) {
            isResizing = false;
            splitDivider.classList.remove("active");
            document.body.classList.remove("resizing-active");
        }
    };

    splitDivider.addEventListener("mousedown", startResize);
    splitDivider.addEventListener("touchstart", startResize, { passive: true });

    document.addEventListener("mousemove", resize);
    document.addEventListener("touchmove", resize, { passive: false });

    document.addEventListener("mouseup", stopResize);
    document.addEventListener("touchend", stopResize);

    // モーダルの枠外（オーバーレイ部分）をタップした際に閉じる
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });

    // ==========================================
    // スワイプ画面切り替え機能
    // ==========================================
    initSwipeNavigation();
}

// 状態フィルター適用
function setTodoFilter(filter) {
    currentTodoFilter = filter;
    document.querySelectorAll("#page-todo div:first-child button").forEach(b => {
        if (b.id && b.id.startsWith("todo-filter-")) {
            b.className = "btn btn-secondary";
        }
    });
    document.getElementById(`todo-filter-${filter}`).className = "btn btn-primary";
    renderTodoList();
}

// カテゴリタグフィルター適用
function setTagFilter(tag) {
    currentTagFilter = tag;
    document.querySelectorAll("[id^='tag-filter-']").forEach(b => {
        b.className = "btn btn-secondary";
    });
    document.getElementById(`tag-filter-${tag}`).className = "btn btn-primary";
    renderTodoList();
}

// ==========================================
// 6. ユーティリティ
// ==========================================

function getCountdown(deadlineStr) {
    const now = new Date();
    const deadline = new Date(deadlineStr);
    const diffMs = deadline - now;

    if (diffMs < 0) return { days: -1, text: "期日終了" };

    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffMs < 1000 * 60 * 60 * 24) {
        const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
        if (diffHrs <= 0) return { days: 0, text: "本日締切！" };
        return { days: 0, text: `残り ${diffHrs}時間` };
    }

    if (diffDays === 1) return { days: 1, text: "明日締切！" };

    return { days: diffDays, text: `残り ${diffDays}日` };
}

function formatDate(dateTimeStr) {
    if (!dateTimeStr) return "";
    const parts = dateTimeStr.split("T");
    const date = parts[0].replace(/-/g, "/");
    const time = parts[1] || "";
    return `${date} ${time}`;
}

function formatDateShort(dateTimeStr) {
    if (!dateTimeStr) return "";
    const datePart = dateTimeStr.split("T")[0];
    const parts = datePart.split("-");
    return `${parts[1]}/${parts[2]}`;
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTimeLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
}

function rgbToHex(rgb) {
    if (!rgb || rgb.indexOf('rgb') !== 0) return rgb;
    const matches = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!matches) return rgb;
    function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
    }
    return "#" + hex(matches[1]) + hex(matches[2]) + hex(matches[3]);
}

function compressImage(base64Str, maxWidth, quality, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", quality);
        callback(compressed);
    };
}

// ポップアップメニュー制御用
function toggleActionMenu(id, event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;
    const isShow = menu.classList.contains('show');
    closeAllMenus();
    if (!isShow) {
        menu.classList.add('show');
    }
}

function closeAllMenus() {
    document.querySelectorAll('.action-menu').forEach(m => m.classList.remove('show'));
}

// タイムラインの空き時間から予定を追加する処理
function openAddEventFromTimeline(startTime, endTime) {
    const now = new Date();
    const dateStr = formatDateISO(now);

    document.getElementById("event-modal-title").innerText = "予定の追加";
    document.getElementById("form-event").reset();
    document.getElementById("event-id").value = "";

    document.getElementById("event-start").value = `${dateStr}T${startTime}`;
    document.getElementById("event-end").value = `${dateStr}T${endTime}`;

    document.getElementById("event-color").value = THEME_COLORS[1];
    const picker = document.getElementById("event-color-picker");
    if (picker && picker.children.length > 1) {
        picker.querySelectorAll(".color-option").forEach(o => o.classList.remove("selected"));
        picker.children[1].classList.add("selected");
    }

    openModal("modal-event-edit");
}

// 見比べ画面からの編集・削除の振り分けヘルパー
function openEditEventOrWeekly(id, type) {
    if (type === 'weekly') {
        openEditWeeklyEvent(id);
    } else {
        openEditEvent(id);
    }
}

function deleteEventOrWeekly(id, type, event) {
    if (type === 'weekly') {
        deleteWeeklySchedule(id, event);
    } else {
        if (event) event.stopPropagation();
        deleteEvent(id);
    }
}

// ==========================================
// 7. 実質残り時間バランサー ＆ 自動リスケ機能
// ==========================================

// トースト通知を表示
function showToast(message, type = 'success') {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    // アニメーションが終了したら削除 (3秒後)
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 特定の日の予定（習慣＋単発）を分単位のビジースロット[startMin, endMin]として取得しマージする
function getBusySlotsForDate(date) {
    const dateISO = formatDateISO(date);
    const dow = date.getDay();

    const todayWeekly = state.weeklySchedule.filter(w => w.day === dow);
    const todayEvents = state.events.filter(ev => isEventOnDate(ev, dateISO));

    let slots = [];

    todayWeekly.forEach(w => {
        let start, end;
        if (w.timeblock === 'morning') { start = 480; end = 600; }
        else if (w.timeblock === 'afternoon') { start = 780; end = 900; }
        else if (w.timeblock === 'evening') { start = 1080; end = 1200; }
        else {
            const sParts = (w.startTime || "09:00").split(":");
            start = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);
            const eParts = (w.endTime || "10:00").split(":");
            end = parseInt(eParts[0]) * 60 + parseInt(eParts[1]);
        }
        if (end <= start) end = start + 60;
        slots.push({ start, end });
    });

    todayEvents.forEach(ev => {
        let start, end;
        if (ev.allDay) {
            start = 480; end = 1320;
        } else {
            const startStr = ev.start.split("T")[1] || "09:00";
            const sParts = startStr.split(":");
            start = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);

            let endStr = "10:00";
            if (ev.end) {
                endStr = ev.end.split("T")[1] || "10:00";
            } else {
                const endH = String(Math.floor(start / 60) + 1).padStart(2, '0');
                const endM = String(start % 60).padStart(2, '0');
                endStr = `${endH}:${endM}`;
            }
            const eParts = endStr.split(":");
            end = parseInt(eParts[0]) * 60 + parseInt(eParts[1]);
        }
        if (end <= start) end = start + 60;
        slots.push({ start, end });
    });

    // 開始順にソート
    slots.sort((a, b) => a.start - b.start);

    // マージ処理
    let merged = [];
    slots.forEach(s => {
        if (merged.length === 0) {
            merged.push(s);
        } else {
            let last = merged[merged.length - 1];
            if (s.start < last.end) {
                last.end = Math.max(last.end, s.end);
            } else {
                merged.push(s);
            }
        }
    });

    return merged;
}

// 締切までの実質的な空き時間（時間数）を計算
function calculateFreeTimeRemaining(deadlineStr) {
    if (!deadlineStr) return 0;
    const now = new Date();
    const deadline = new Date(deadlineStr);

    if (now >= deadline) return 0;

    let totalFreeMinutes = 0;

    // 現在日から締切日まで日単位でループ
    let currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);

    const targetEnd = new Date(deadline);
    targetEnd.setHours(0, 0, 0, 0);

    while (currentDate <= targetEnd) {
        // その日の活動可能範囲（08:00 - 22:00 = 480 - 1320分）
        let startLimit = 480;
        let endLimit = 1320;

        const isToday = currentDate.getTime() === (new Date(now).setHours(0, 0, 0, 0));
        const isDeadlineDay = currentDate.getTime() === targetEnd.getTime();

        if (isToday) {
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            startLimit = Math.max(480, nowMinutes);
        }
        if (isDeadlineDay) {
            const deadlineMinutes = deadline.getHours() * 60 + deadline.getMinutes();
            endLimit = Math.min(1320, deadlineMinutes);
        }

        if (startLimit < endLimit) {
            const busySlots = getBusySlotsForDate(currentDate);

            // 活動可能範囲内のbusy時間を計算
            let busyMinutes = 0;
            busySlots.forEach(slot => {
                const s = Math.max(startLimit, slot.start);
                const e = Math.min(endLimit, slot.end);
                if (s < e) {
                    busyMinutes += (e - s);
                }
            });

            const dayFreeMinutes = (endLimit - startLimit) - busyMinutes;
            if (dayFreeMinutes > 0) {
                totalFreeMinutes += dayFreeMinutes;
            }
        }

        // 次の日に進む
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return parseFloat((totalFreeMinutes / 60).toFixed(1));
}

// ミリ秒単位の所要時間を満たす次の空きスロット（明日以降）を探索
function findNextAvailableFreeSlot(durationMs) {
    const durationMin = Math.ceil(durationMs / (60 * 1000));
    const now = new Date();

    // 「ワンタップ翌日スキップ」なので翌日の08:00から探索を開始する
    let searchDate = new Date(now);
    searchDate.setDate(searchDate.getDate() + 1);
    searchDate.setHours(8, 0, 0, 0);

    // 最大30日間探索する
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const busySlots = getBusySlotsForDate(searchDate);

        // 08:00 (480) 〜 22:00 (1320) の空きスロットをリストアップ
        let currentMin = 480;
        let freeSlots = [];

        busySlots.forEach(slot => {
            if (slot.start - currentMin >= durationMin) {
                freeSlots.push({ start: currentMin, end: slot.start });
            }
            currentMin = Math.max(currentMin, slot.end);
        });

        if (1320 - currentMin >= durationMin) {
            freeSlots.push({ start: currentMin, end: 1320 });
        }

        // 最初の適合スロットが見つかったら返す
        if (freeSlots.length > 0) {
            const chosen = freeSlots[0];
            const startHour = Math.floor(chosen.start / 60);
            const startMin = chosen.start % 60;

            const startRes = new Date(searchDate);
            startRes.setHours(startHour, startMin, 0, 0);

            const endRes = new Date(startRes.getTime() + durationMs);
            return { start: startRes, end: endRes };
        }

        searchDate.setDate(searchDate.getDate() + 1);
    }

    // 万が一見つからない場合は、明日の09:00〜10:00などをフォールバックとする
    let fallbackStart = new Date(now);
    fallbackStart.setDate(fallbackStart.getDate() + 1);
    fallbackStart.setHours(9, 0, 0, 0);
    let fallbackEnd = new Date(fallbackStart.getTime() + durationMs);
    return { start: fallbackStart, end: fallbackEnd };
}

// 予定を自動リスケ（翌日以降の空き時間に移動）
function rescheduleEvent(eventId, eventType) {
    if (eventType === 'weekly') {
        showToast("習慣スケジュールはリスケできません（単発予定のみ有効です）。", "warning");
        return;
    }

    const idx = state.events.findIndex(e => e.id === eventId);
    if (idx === -1) return;

    const ev = state.events[idx];

    // イベントの所要時間を算出 (デフォルト1時間)
    let durationMs = 60 * 60 * 1000;
    if (ev.start) {
        const startT = new Date(ev.start).getTime();
        const endT = ev.end ? new Date(ev.end).getTime() : startT + durationMs;
        durationMs = Math.max(30 * 60 * 1000, endT - startT); // 最低30分
    }

    // 次の空きスロットを探索
    const newSlot = findNextAvailableFreeSlot(durationMs);

    // イベント更新
    ev.start = formatDateTimeLocal(newSlot.start);
    ev.end = formatDateTimeLocal(newSlot.end);
    ev.allDay = false; // 終日だった場合も時間指定に変換

    saveData();

    // 画面の更新
    renderCalendar();
    renderDashboard();
    renderSplitView();

    // トースト通知
    const dateStr = `${newSlot.start.getMonth() + 1}/${newSlot.start.getDate()}`;
    const timeStr = `${String(newSlot.start.getHours()).padStart(2, '0')}:${String(newSlot.start.getMinutes()).padStart(2, '0')}`;
    showToast(`予定「${ev.title}」を ${dateStr} ${timeStr} にリスケしました！`, "success");
}
