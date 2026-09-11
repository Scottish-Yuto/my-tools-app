// 「このファイルはブラウザで動く処理を使う」と宣言するための合図
"use client";

// React の機能を読み込む
// useState: 画面で使うデータを保持
// useEffect: 画面の表示時や値の変化時に処理を実行
// useMemo: 何度も計算しないように、必要なときだけ結果を返す
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// タスクの優先度（高・中・低）
type TaskPriority = "high" | "medium" | "low";
// 絞り込み
type TaskFilter = "all" | "active" | "done";
// 繰り返し設定
type TaskRepeat = "none" | "daily" | "weekly";

// タスクの型を定義
// done: 完了したかどうか
// priority: 優先度
// order: 手動の並び順（ドラッグ&ドロップで変わる）
// repeat: 完了時に次の予定を自動で作る繰り返し設定
// repeatWeekdays: 毎週の場合に対象とする曜日（0=日〜6=土）。空なら元の曜日のまま7日後
type Task = {
  id: number;
  text: string;
  detail: string;
  done: boolean;
  priority: TaskPriority;
  date: string;
  order: number;
  repeat: TaskRepeat;
  repeatWeekdays: number[];
};

// よく使うリンクの型を定義
// label: 表示する名前, url: 行き先のURL, emoji: アイコン
type Shortcut = {
  id: number;
  label: string;
  url: string;
  emoji: string;
};

// メモの型を定義。tagで複数のメモを区別する
// scope: "common"は共通、"date"は指定した日だけ表示
type MemoScope = "common" | "date";

type Memo = {
  id: number;
  tag: string;
  text: string;
  scope: MemoScope;
  date: string;
};

// 優先度を数値で管理
const priorityOrder: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// 優先度：日本語対応表
const priorityLabel: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// 優先度セレクトボックスの選択肢。追加フォームと編集フォームで共通利用
const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

// 優先度バッジの色（一覧のラベル表示で使う）
const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "bg-rose-500/20 text-rose-200",
  medium: "bg-amber-500/20 text-amber-200",
  low: "bg-emerald-500/20 text-emerald-200",
};

// カレンダーの日付に付ける丸印の色
const priorityDotClass: Record<TaskPriority, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-400",
  low: "bg-cyan-400",
};

// 優先度フィルターボタンが選ばれているときの色
const priorityActiveClass: Record<TaskPriority, string> = {
  high: "bg-rose-500 text-slate-950",
  medium: "bg-amber-500 text-slate-950",
  low: "bg-emerald-500 text-slate-950",
};

// 繰り返し設定セレクトボックスの選択肢
const repeatOptions: { value: TaskRepeat; label: string }[] = [
  { value: "none", label: "繰り返さない" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
];

// 繰り返し設定を短く表示するための対応表
const repeatIcon: Record<TaskRepeat, string> = {
  none: "",
  daily: "🔁 毎日",
  weekly: "🔁 毎週",
};

// 日付を「2024-08-30」の形に直す。タスクを日付ごとに分類するために使う
const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// 毎週の繰り返しで、次に予定を作る日付を計算する
// 曜日の指定があれば、翌日以降で最初に一致する曜日を探す。指定がなければ7日後
const getNextWeeklyDate = (currentDateKey: string, weekdays: number[]) => {
  const current = new Date(`${currentDateKey}T00:00:00`);

  if (weekdays.length === 0) {
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    return next;
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(current);
    candidate.setDate(candidate.getDate() + offset);
    if (weekdays.includes(candidate.getDay())) return candidate;
  }

  const fallback = new Date(current);
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
};

// 曜日の選択をオン/オフ切り替える
const toggleWeekdaySelection = (day: number, current: number[]) =>
  current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b);

// 最初に表示するサンプルタスク
const defaultTasks: Task[] = [];

// 最初に表示するよく使うリンク
const defaultShortcuts: Shortcut[] = [
  { id: 1, label: "Gmail", url: "https://mail.google.com", emoji: "✉️" },
  { id: 2, label: "Notion", url: "https://www.notion.so", emoji: "📝" },
  { id: 3, label: "GitHub", url: "https://github.com", emoji: "💻" },
];

// 最初に表示するメモ
const defaultMemos: Memo[] = [{ id: 1, tag: "メモ", text: "", scope: "common", date: formatDateKey(new Date()) }];

// カレンダーの曜日の並びを決める配列
const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

// 指定した月のカレンダーを作る関数
// 1日が何曜日から始まるかを計算し、前の月の空白も含めて 42 日分を並べる
const getCalendarDays = (baseDate: Date) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  // 月の最初の日を基準に、そこから何日前に月曜日があるかを計算
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());

  const days: Date[] = [];

  // 6週間（42日）分の日付を配列に追加
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    days.push(date);
  }

  return days;
};

// 選択中かどうかで色が変わる丸ボタン。フィルターや切り替えボタンで繰り返し使う
function FilterPill({
  active,
  onClick,
  children,
  activeClassName = "bg-cyan-500 text-slate-950",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-2.5 py-1 text-xs transition",
        active ? activeClassName : "bg-transparent text-slate-300 hover:bg-slate-700/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// メイン画面のコンポーネント
export default function Home() {
  // 画面で使う各種データを定義

  // タスク関連
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [taskDate, setTaskDate] = useState(formatDateKey(new Date()));
  const [taskDetail, setTaskDetail] = useState("");
  const [taskRepeat, setTaskRepeat] = useState<TaskRepeat>("none");
  const [taskRepeatWeekdays, setTaskRepeatWeekdays] = useState<number[]>([]);
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<TaskPriority | "all">("all");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editDate, setEditDate] = useState(formatDateKey(new Date()));
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editRepeat, setEditRepeat] = useState<TaskRepeat>("none");
  const [editRepeatWeekdays, setEditRepeatWeekdays] = useState<number[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  // 表示設定
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // メモとリンク
  const [memos, setMemos] = useState<Memo[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("");
  const [shortcutUrl, setShortcutUrl] = useState("");

  // 日時とカレンダー
  const [isReady, setIsReady] = useState(false);
  const [now, setNow] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ブラウザ通知
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notifiedRef = useRef(false);

  // ログインとクラウド同期
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [cloudReady, setCloudReady] = useState(false);

  // ページが開かれたときにブラウザに保存されたデータを読み込む
  // localStorage はブラウザの保存箱のようなもの
  useEffect(() => {
    const savedTasks = localStorage.getItem("my-tools-tasks");
    const savedMemos = localStorage.getItem("my-tools-memos");
    const legacyMemo = localStorage.getItem("my-tools-memo");
    const savedShortcuts = localStorage.getItem("my-tools-shortcuts");
    const todayKey = formatDateKey(new Date());

    // 保存データがあれば使う。なければ最初のデータを使う
    const loadedTasks = savedTasks ? JSON.parse(savedTasks) : defaultTasks;
    setTasks(
      loadedTasks.map((task: Partial<Task>, index: number) => ({
        id: task.id ?? Date.now(),
        text: task.text ?? "",
        detail: task.detail ?? "",
        done: Boolean(task.done),
        priority: task.priority ?? "medium",
        date: task.date ?? todayKey,
        order: task.order ?? index,
        repeat: task.repeat ?? "none",
        repeatWeekdays: task.repeatWeekdays ?? [],
      })),
    );
    setTaskDate(todayKey);
    setSelectedDate(new Date());

    // 複数メモの保存データがあれば使う。なければ旧形式のメモを移行するか、最初のデータを使う
    if (savedMemos) {
      setMemos(
        JSON.parse(savedMemos).map((memo: Partial<Memo>) => ({
          id: memo.id ?? Date.now(),
          tag: memo.tag ?? "メモ",
          text: memo.text ?? "",
          scope: memo.scope ?? "common",
          date: memo.date ?? todayKey,
        })),
      );
    } else if (legacyMemo) {
      setMemos([{ id: Date.now(), tag: "メモ", text: legacyMemo, scope: "common", date: todayKey }]);
    } else {
      setMemos(defaultMemos);
    }

    setShortcuts(savedShortcuts ? JSON.parse(savedShortcuts) : defaultShortcuts);
    setIsReady(true);
  }, []);

  // 1 秒ごとに現在時刻を更新し、時計のように動かす
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // タスクの中身が変わったら、ブラウザに保存する
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("my-tools-tasks", JSON.stringify(tasks));
  }, [tasks, isReady]);

  // メモの内容が変わったら、ブラウザに保存する
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("my-tools-memos", JSON.stringify(memos));
  }, [memos, isReady]);

  // リンク一覧が変わったら、ブラウザに保存する
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("my-tools-shortcuts", JSON.stringify(shortcuts));
  }, [shortcuts, isReady]);

  // ログイン状態が変わったら、表示用のユーザー情報を更新する
  useEffect(() => {
    if (!supabase) return;

    const updateUser = (user: { id: string; email?: string } | null) => {
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? "");
      setCloudReady(false);
    };

    supabase.auth.getUser().then(({ data }) => updateUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ログイン直後にクラウドのデータを読み込む。初回は端末のデータをクラウドへ保存する
  useEffect(() => {
    if (!supabase || !isReady || !userId || cloudReady) return;
    const client = supabase;

    const loadCloudData = async () => {
      const { data, error } = await client
        .from("user_data")
        .select("tasks, memos, shortcuts")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        setAuthMessage("クラウドデータを読み込めませんでした");
        return;
      }

      if (data) {
        setTasks(data.tasks as Task[]);
        setMemos(data.memos as Memo[]);
        setShortcuts(data.shortcuts as Shortcut[]);
      } else {
        const { error: saveError } = await client
          .from("user_data")
          .upsert({ user_id: userId, tasks, memos, shortcuts, updated_at: new Date().toISOString() });
        if (saveError) {
          setAuthMessage("最初のクラウド保存に失敗しました");
          return;
        }
      }

      setCloudReady(true);
    };

    void loadCloudData();
  }, [cloudReady, isReady, userId]);

  // クラウドの読み込みが済んだ後は、データ変更をSupabaseへ保存する
  useEffect(() => {
    if (!supabase || !userId || !cloudReady) return;

    void supabase
      .from("user_data")
      .upsert({ user_id: userId, tasks, memos, shortcuts, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) setAuthMessage("クラウド保存に失敗しました");
      });
  }, [cloudReady, memos, shortcuts, tasks, userId]);

  // カレンダーを表示するために、必要な日付を計算する
  const monthDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate]);

  // 日付ごとのタスク件数と最も高い優先度を集計。カレンダーの印に使う
  const tasksByDate = useMemo(() => {
    const result: Record<string, { count: number; highestPriority: TaskPriority }> = {};

    tasks.forEach((task) => {
      const current = result[task.date] ?? { count: 0, highestPriority: "low" };
      const nextHighest =
        priorityOrder[task.priority] > priorityOrder[current.highestPriority]
          ? task.priority
          : current.highestPriority;

      result[task.date] = {
        count: current.count + 1,
        highestPriority: nextHighest,
      };
    });

    return result;
  }, [tasks]);
  const currentMonth = calendarDate.getMonth();
  const currentYear = calendarDate.getFullYear();
  const selectedDateKey = formatDateKey(selectedDate);

  // 完了したタスクの数を数える
  const completedCount = tasks.filter((task) => task.done).length;

  // 進捗率を計算する
  // 例: 2 / 4 = 50%
  const progressRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // 表示するタスクを作る。日付・状態・優先度・検索文字の条件を順番に適用
  const visibleTasks = useMemo(() => {
    // 全期間なら全タスク、日付別なら選択した日だけを取り出す
    const filtered = showAllTasks ? tasks : tasks.filter((task) => task.date === selectedDateKey);

    // 検索文字は前後の空白を無視して、大文字小文字を区別せずに比較する
    const query = taskSearchQuery.trim().toLowerCase();

    // 状態・優先度・検索文字、すべての条件に合うタスクだけを残す
    const finalFiltered = filtered.filter((task) => {
      const matchesStatus =
        taskFilter === "all" || (taskFilter === "active" ? !task.done : task.done);
      const matchesPriority = taskPriorityFilter === "all" || task.priority === taskPriorityFilter;
      const matchesSearch =
        query === "" ||
        task.text.toLowerCase().includes(query) ||
        task.detail.toLowerCase().includes(query);
      return matchesStatus && matchesPriority && matchesSearch;
    });

    // 未完了を先に並べ、同じ状態なら手動の並び順（order）で並べる
    return [...finalFiltered].sort((left, right) => {
      if (left.done !== right.done) return Number(left.done) - Number(right.done);
      return left.order - right.order;
    });
  }, [tasks, taskFilter, selectedDateKey, showAllTasks, taskPriorityFilter, taskSearchQuery]);

  // 表示するメモを作る。共通メモは常に、日付メモは選択中の日だけ表示
  const visibleMemos = useMemo(
    () => memos.filter((memo) => memo.scope === "common" || memo.date === selectedDateKey),
    [memos, selectedDateKey],
  );

  // カレンダーの月を進める・戻す
  const changeMonth = (offset: number) => {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  // カレンダーとタスクの日付を今日に戻す
  const resetCalendarToToday = () => {
    const today = new Date(now);
    setCalendarDate(today);
    setSelectedDate(today);
    setTaskDate(formatDateKey(today));
  };

  // 新しいタスクをリストに追加処理
  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    const safeText = inputText.trim();

    // 何も入力されていなかったら何もしない
    if (!safeText) return;

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: Date.now(),
        text: safeText,
        detail: taskDetail.trim(),
        done: false,
        priority: taskPriority,
        date: taskDate,
        order: Date.now(),
        repeat: taskRepeat,
        repeatWeekdays: taskRepeat === "weekly" ? taskRepeatWeekdays : [],
      },
    ]);

    // 入力欄を空に
    setInputText("");
    setTaskDetail("");
    setTaskPriority("medium");
    setTaskRepeat("none");
    setTaskRepeatWeekdays([]);
    setTaskDate(selectedDateKey);
    setShowAddTaskForm(false);
  };

  // タスクの完了状態を切り替える処理。繰り返し設定があれば次回分を自動で作る
  const toggleTask = (taskId: number) => {
    setTasks((currentTasks) => {
      const target = currentTasks.find((task) => task.id === taskId);
      const updated = currentTasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      );

      // 未完了 → 完了に切り替えた瞬間だけ、次の予定を作る
      if (target && !target.done && target.repeat !== "none") {
        const nextDate =
          target.repeat === "weekly"
            ? getNextWeeklyDate(target.date, target.repeatWeekdays)
            : (() => {
                const daily = new Date(`${target.date}T00:00:00`);
                daily.setDate(daily.getDate() + 1);
                return daily;
              })();

        updated.push({
          ...target,
          id: Date.now(),
          done: false,
          date: formatDateKey(nextDate),
          order: Date.now(),
        });
      }

      return updated;
    });
  };

  // 指定したタスクを削除する処理（確認ダイアログでOKされたときだけ削除）
  const deleteTask = (taskId: number) => {
    if (!window.confirm("このタスクを削除しますか？")) return;
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  };

  // 編集画面を開く。編集するタスクの内容を入力欄に反映
  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setEditDetail(task.detail);
    setEditDate(task.date);
    setEditPriority(task.priority);
    setEditRepeat(task.repeat);
    setEditRepeatWeekdays(task.repeatWeekdays);
  };

  // 編集用の入力欄をすべて初期状態に戻す（保存後・キャンセル時どちらでも使う）
  const resetEditState = () => {
    setEditingTaskId(null);
    setEditText("");
    setEditDetail("");
    setEditDate(formatDateKey(new Date()));
    setEditPriority("medium");
    setEditRepeat("none");
    setEditRepeatWeekdays([]);
  };

  // 編集内容を保存。タスクリストを更新
  const saveEditTask = (event: React.FormEvent) => {
    event.preventDefault();
    const safeText = editText.trim();

    if (!editingTaskId || !safeText) return;

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              text: safeText,
              detail: editDetail.trim(),
              date: editDate,
              priority: editPriority,
              repeat: editRepeat,
              repeatWeekdays: editRepeat === "weekly" ? editRepeatWeekdays : [],
            }
          : task,
      ),
    );

    resetEditState();
  };

  // 編集をやめて、入力欄の内容を空に戻す
  const cancelEditTask = () => {
    resetEditState();
  };

  // よく使うリンクを追加する処理
  const addShortcut = (event: React.FormEvent) => {
    event.preventDefault();
    const label = shortcutLabel.trim();
    const url = shortcutUrl.trim();

    // 名前か URL が空だったら追加しない
    if (!label || !url) return;

    setShortcuts((currentShortcuts) => [
      ...currentShortcuts,
      {
        id: Date.now(),
        label,
        url: url.startsWith("http") ? url : `https://${url}`,
        emoji: "🔗",
      },
    ]);

    // 入力欄を空に
    setShortcutLabel("");
    setShortcutUrl("");
  };

  // リンクを削除する処理（確認ダイアログでOKされたときだけ削除）
  const deleteShortcut = (shortcutId: number) => {
    if (!window.confirm("このリンクを削除しますか？")) return;
    setShortcuts((currentShortcuts) => currentShortcuts.filter((shortcut) => shortcut.id !== shortcutId));
  };

  // カレンダーの日を選び、タスク表示と追加する日付を合わせる
  const handleCalendarDayClick = (date: Date) => {
    setSelectedDate(date);
    setCalendarDate(new Date(date.getFullYear(), date.getMonth(), 1));
    setTaskDate(formatDateKey(date));
  };

  // ドラッグしたタスクのIDを覚えておく
  const handleTaskDragStart = (taskId: number) => {
    setDraggedTaskId(taskId);
  };

  // ドロップされた位置に合わせて、表示中のタスクの並び順（order）を作り直す
  const handleTaskDrop = (targetTaskId: number) => {
    if (draggedTaskId === null || draggedTaskId === targetTaskId) return;

    const visibleIds = visibleTasks.map((task) => task.id);
    const draggedIndex = visibleIds.indexOf(draggedTaskId);
    const targetIndex = visibleIds.indexOf(targetTaskId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    // ドラッグしたIDを抜いて、ドロップ先の位置に差し込む
    const reorderedIds = [...visibleIds];
    reorderedIds.splice(draggedIndex, 1);
    reorderedIds.splice(targetIndex, 0, draggedTaskId);

    // 新しい並び順を0,1,2...のorder値としてタスクに反映する
    const orderMap = new Map(reorderedIds.map((id, index) => [id, index]));
    setTasks((currentTasks) =>
      currentTasks.map((task) => (orderMap.has(task.id) ? { ...task, order: orderMap.get(task.id)! } : task)),
    );
    setDraggedTaskId(null);
  };

  // ブラウザ通知の使用許可をリクエストする
  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  };

  // メールに届くリンクを開くと、そのままログインできる
  // メール＋パスワードでのログイン・新規登録処理
  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !loginEmail.trim() || !loginPassword) return;

    setAuthMessage("処理中...");

    if (isSignUp) {
      // 新規登録
      const { error } = await supabase.auth.signUp({
        email: loginEmail.trim(),
        password: loginPassword,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      setAuthMessage(
        error ? `登録エラー: ${error.message}` : "確認メールを送信しました。メール内のリンクをクリックしてください。"
      );
    } else {
      // ログイン
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      setAuthMessage(
        error ? `ログインエラー: ${error.message}` : "ログインしました"
      );
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthMessage("ログアウトしました");
  };

  // 今日期限で未完了のタスクがあれば、1回だけブラウザ通知を出す
  useEffect(() => {
    if (!isReady || !notificationsEnabled || notifiedRef.current) return;

    const todayKey = formatDateKey(new Date());
    const dueToday = tasks.filter((task) => task.date === todayKey && !task.done);
    if (dueToday.length === 0) return;

    new Notification("今日のタスク", {
      body: `${dueToday.length}件のタスクが今日期限です`,
    });
    notifiedRef.current = true;
  }, [isReady, notificationsEnabled, tasks]);

  // よく使うタグ・並び替え・メモの操作
  const addMemo = () => {
    setMemos((current) => [
      ...current,
      { id: Date.now(), tag: "新しいタグ", text: "", scope: "common", date: selectedDateKey },
    ]);
  };

  const updateMemoTag = (memoId: number, tag: string) => {
    setMemos((current) => current.map((memo) => (memo.id === memoId ? { ...memo, tag } : memo)));
  };

  const updateMemoText = (memoId: number, text: string) => {
    setMemos((current) => current.map((memo) => (memo.id === memoId ? { ...memo, text } : memo)));
  };

  // メモを「毎日共通」か「選択中の日付だけ」に切り替える
  const updateMemoScope = (memoId: number, scope: MemoScope) => {
    setMemos((current) =>
      current.map((memo) => (memo.id === memoId ? { ...memo, scope, date: selectedDateKey } : memo)),
    );
  };

  // メモを削除する処理（確認ダイアログでOKされたときだけ削除）
  const deleteMemo = (memoId: number) => {
    if (!window.confirm("このメモを削除しますか？")) return;
    setMemos((current) => current.filter((memo) => memo.id !== memoId));
  };

  // HTML ---------------------------------------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー部分。ページのタイトルと現在時刻を表示する */}
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">MY TOOLS</p>
              <h1 className="mt-2 text-3xl font-bold text-white">Today's Task</h1>
              {supabase ? (
                userId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-emerald-300">
                      {cloudReady ? "クラウド同期中" : "クラウドを読み込み中"}: {userEmail}
                    </span>
                    <button
                      type="button"
                      onClick={signOut}
                      className="rounded-lg border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                    >
                      ログアウト
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="メールアドレス"
                    required
                    className="w-32 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="パスワード"
                    required
                    className="w-32 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-cyan-500 px-2 py-1 text-xs font-medium text-slate-950 transition hover:bg-cyan-400"
                  >
                    {isSignUp ? "登録する" : "ログイン"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200"
                  >
                    {isSignUp ? "ログインに切り替え" : "新規登録に切り替え"}
                  </button>
                </form>
                )
              ) : (
                <p className="mt-3 text-xs text-amber-200">Supabaseの環境変数を設定するとクラウド同期を使えます</p>
              )}
              {authMessage && <p className="mt-2 text-xs text-slate-300">{authMessage}</p>}
            </div>
            <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Now</p>
              <p className="mt-1 text-lg font-semibold text-cyan-100">
                {new Intl.DateTimeFormat("ja-JP", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                }).format(now)}
              </p>
              <p className="text-sm text-cyan-100/90">{now.toLocaleTimeString("ja-JP")}</p>
              <button
                type="button"
                onClick={enableNotifications}
                className="mt-2 rounded-lg bg-cyan-500/20 px-2 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/30"
              >
                {notificationsEnabled ? "🔔 通知オン" : "🔔 通知を有効にする"}
              </button>
            </div>
          </div>

          {/* 3 つのカードで、進捗状況を一目で確認できるようにする */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-sky-500/5 p-5">
              <p className="text-sm text-cyan-200">完了タスク</p>
              <p className="mt-3 text-3xl font-bold text-white">{completedCount} / {tasks.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-purple-500/5 p-5">
              <p className="text-sm text-violet-200">進捗率</p>
              <p className="mt-3 text-3xl font-bold text-white">{progressRate}%</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-green-500/5 p-5">
              <p className="text-sm text-emerald-200">メモ</p>
              <p className="mt-3 text-3xl font-bold text-white">
                {visibleMemos.some((memo) => memo.text.trim()) ? "記録済み" : "未記入"}
              </p>
            </div>
          </section>
        </header>

        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-white">📅 Calendar</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 transition hover:border-cyan-400"
                  >
                    ←
                  </button>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">
                    {currentYear}年 {currentMonth + 1}月
                  </span>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 transition hover:border-cyan-400"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={resetCalendarToToday}
                    className="rounded-lg bg-cyan-500/20 px-2 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/30"
                  >
                    今日
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wider text-slate-400">
                {weekdayNames.map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthDays.map((date) => {
                  const isCurrentMonth = date.getMonth() === currentMonth;
                  const isToday =
                    date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
                  const dateKey = formatDateKey(date);
                  const taskMeta = tasksByDate[dateKey] ?? { count: 0, highestPriority: "low" };
                  const taskCount = taskMeta.count;
                  const badgeColor = priorityDotClass[taskMeta.highestPriority];

                  return (
                    <button
                      key={`${date.toISOString()}-${date.getDate()}`}
                      type="button"
                      onClick={() => handleCalendarDayClick(date)}
                      className={[
                        "relative flex h-12 items-center justify-center rounded-xl border text-sm transition hover:border-cyan-400",
                        isCurrentMonth ? "border-slate-700 bg-slate-800/80 text-slate-100" : "border-slate-800 bg-slate-900/50 text-slate-500",
                        isToday ? "border-cyan-400 bg-cyan-500/20 font-bold text-cyan-200" : "",
                        formatDateKey(date) === selectedDateKey ? "ring-2 ring-cyan-400" : "",
                      ].join(" ")}
                    >
                      <span>{date.getDate()}</span>
                      {taskCount > 0 && (
                        <span
                          className={[
                            "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-slate-950 ring-2 ring-slate-900",
                            badgeColor,
                          ].join(" ")}
                        >
                          {taskCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">✅ Task</h2>
                <button
                  type="button"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/30"
                >
                  {showFilterMenu ? "✕ 閉じる" : "☰"}
                </button>
              </div>

              {showFilterMenu && (
                /* メニューバー：絶対配置のポップオーバーで、最前面に表示 */
                <div className="absolute right-5 top-16 z-40 w-72 space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                  {/* 日付別/全期間の切り替え */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-300">期間</label>
                    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 p-1">
                      <FilterPill active={!showAllTasks} onClick={() => setShowAllTasks(false)}>
                        日付別
                      </FilterPill>
                      <FilterPill active={showAllTasks} onClick={() => setShowAllTasks(true)}>
                        全期間
                      </FilterPill>
                    </div>
                  </div>

                  {/* 状態でフィルター */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-300">状態</label>
                    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 p-1">
                      {[
                        { value: "all", label: "すべて" },
                        { value: "active", label: "未完了" },
                        { value: "done", label: "完了済み" },
                      ].map((filter) => (
                        <FilterPill
                          key={filter.value}
                          active={taskFilter === filter.value}
                          onClick={() => setTaskFilter(filter.value as TaskFilter)}
                        >
                          {filter.label}
                        </FilterPill>
                      ))}
                    </div>
                  </div>

                  {/* 優先度でフィルター */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase text-slate-300">優先度</label>
                    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 p-1">
                      <FilterPill active={taskPriorityFilter === "all"} onClick={() => setTaskPriorityFilter("all")}>
                        すべて
                      </FilterPill>
                      {priorityOptions.map((option) => (
                        <FilterPill
                          key={option.value}
                          active={taskPriorityFilter === option.value}
                          onClick={() => setTaskPriorityFilter(option.value)}
                          activeClassName={priorityActiveClass[option.value]}
                        >
                          {option.label}
                        </FilterPill>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {showAddTaskForm && (
                <div className="absolute bottom-20 right-5 z-40 w-80 max-w-[calc(100%-2.5rem)] space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                  <form onSubmit={addTask} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">新しいタスク</h3>
                      <button
                        type="button"
                        onClick={() => setShowAddTaskForm(false)}
                        className="text-2xl text-slate-400 transition hover:text-slate-200"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(event) => setInputText(event.target.value)}
                      placeholder="タスクの内容"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="date"
                        value={taskDate}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTaskDate(value);
                          if (value) {
                            const newDate = new Date(`${value}T00:00:00`);
                            setSelectedDate(newDate);
                            setCalendarDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                      />
                      <select
                        value={taskPriority}
                        onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                      >
                        {priorityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            優先度: {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={taskRepeat}
                      onChange={(event) => setTaskRepeat(event.target.value as TaskRepeat)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                    >
                      {repeatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          繰り返し: {option.label}
                        </option>
                      ))}
                    </select>
                    {taskRepeat === "weekly" && (
                      <div className="flex flex-wrap gap-1.5">
                        {weekdayNames.map((day, index) => (
                          <FilterPill
                            key={day}
                            active={taskRepeatWeekdays.includes(index)}
                            onClick={() => setTaskRepeatWeekdays((current) => toggleWeekdaySelection(index, current))}
                          >
                            {day}
                          </FilterPill>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={taskDetail}
                      onChange={(event) => setTaskDetail(event.target.value)}
                      placeholder="詳細を入力（複数行OK）"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddTaskForm(false)}
                        className="rounded-xl px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400"
                      >
                        追加
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="mb-3 text-sm text-slate-400">
                {showAllTasks
                  ? "全期間を表示中"
                  : new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" }).format(selectedDate)}
              </div>

              {/* タスク名と詳細を対象に検索する */}
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(event) => setTaskSearchQuery(event.target.value)}
                placeholder="🔍 タスクを検索"
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />

              <div className="max-h-96 overflow-y-auto pr-2">
                <ul className="space-y-3">
                  {visibleTasks.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                      表示するタスクがありません
                    </li>
                  ) : (
                    visibleTasks.map((task) => {
                      const isEditing = editingTaskId === task.id;
                      // 今日より前の日付で、まだ完了していなければ期限切れ扱い
                      const isOverdue = !task.done && task.date < formatDateKey(now);

                    return (
                      <li
                        key={task.id}
                        draggable={!isEditing}
                        onDragStart={() => handleTaskDragStart(task.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleTaskDrop(task.id)}
                        className={[
                          "rounded-2xl border p-3",
                          isOverdue ? "border-rose-500/70 bg-rose-950/20" : "border-slate-800 bg-slate-950/40",
                        ].join(" ")}
                      >
                        {isEditing ? (
                          <form onSubmit={saveEditTask} className="space-y-3">
                            <input
                              type="text"
                              value={editText}
                              onChange={(event) => setEditText(event.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                            />
                            <textarea
                              value={editDetail}
                              onChange={(event) => setEditDetail(event.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                            />
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(event) => setEditDate(event.target.value)}
                                className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                              />
                              <select
                                value={editPriority}
                                onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                                className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                              >
                                {priorityOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editRepeat}
                                onChange={(event) => setEditRepeat(event.target.value as TaskRepeat)}
                                className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                              >
                                {repeatOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {editRepeat === "weekly" && (
                              <div className="flex flex-wrap gap-1.5">
                                {weekdayNames.map((day, index) => (
                                  <FilterPill
                                    key={day}
                                    active={editRepeatWeekdays.includes(index)}
                                    onClick={() => setEditRepeatWeekdays((current) => toggleWeekdaySelection(index, current))}
                                  >
                                    {day}
                                  </FilterPill>
                                ))}
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditTask}
                                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                              >
                                キャンセル
                              </button>
                              <button
                                type="submit"
                                className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-cyan-400"
                              >
                                保存
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={task.done}
                                onChange={() => toggleTask(task.id)}
                                className="h-5 w-5 accent-cyan-500"
                              />
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  priorityBadgeClass[task.priority],
                                ].join(" ")}
                              >
                                {priorityLabel[task.priority]}
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center rounded-full bg-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                                  期限切れ
                                </span>
                              )}
                              {task.repeat !== "none" && (
                                <span className="text-xs text-slate-400" title="繰り返しタスク">
                                  {repeatIcon[task.repeat]}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                                className={[
                                  "flex flex-1 items-center gap-1.5 text-left text-sm",
                                  task.done ? "text-slate-500 line-through" : "text-slate-100",
                                ].join(" ")}
                              >
                                <span>{task.text}</span>
                                {task.detail && (
                                  <span
                                    className={[
                                      "text-xs text-slate-400 transition-transform",
                                      expandedTaskId === task.id ? "rotate-180" : "",
                                    ].join(" ")}
                                  >
                                    ▼
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditTask(task)}
                                className="rounded-lg px-2 py-1 text-xs text-cyan-300 transition hover:bg-cyan-500/10 hover:text-cyan-200"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTask(task.id)}
                                className="rounded-lg px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                              >
                                削除
                              </button>
                            </div>

                            {task.detail && expandedTaskId === task.id && (
                              <div className="ml-8 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm whitespace-pre-line text-slate-200">
                                {task.detail}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
                </ul>
              </div>

              {/* 正方形で角が丸い「+」ボタン（固定位置） */}
              <button
                type="button"
                onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 font-bold text-slate-950 shadow-lg transition hover:bg-cyan-400 active:scale-95"
              >
                ＋
              </button>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <section className="h-full rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">📝 Memo</h2>
                <button
                  type="button"
                  onClick={addMemo}
                  className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/30"
                >
                  ＋ 追加
                </button>
              </div>

              {/* タグ付きの複数メモを一覧表示。共通/選択中の日付だけで絞り込む */}
              <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                {visibleMemos.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                    メモがありません
                  </p>
                ) : (
                  visibleMemos.map((memo) => (
                    <div key={memo.id} className="rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={memo.tag}
                          onChange={(event) => updateMemoTag(memo.id, event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-cyan-200 focus:border-cyan-400 focus:outline-none"
                        />
                        <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 p-0.5">
                          <FilterPill active={memo.scope === "common"} onClick={() => updateMemoScope(memo.id, "common")}>
                            共通
                          </FilterPill>
                          <FilterPill active={memo.scope === "date"} onClick={() => updateMemoScope(memo.id, "date")}>
                            この日だけ
                          </FilterPill>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteMemo(memo.id)}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                        >
                          削除
                        </button>
                      </div>
                      <textarea
                        value={memo.text}
                        onChange={(event) => updateMemoText(memo.id, event.target.value)}
                        placeholder="今日の気づきやメモを残そう"
                        rows={4}
                        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="h-full rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <h2 className="mb-4 text-xl font-semibold text-white">⚡ Quick Access</h2>

              <form onSubmit={addShortcut} className="mb-4 space-y-3">
                <input
                  type="text"
                  value={shortcutLabel}
                  onChange={(event) => setShortcutLabel(event.target.value)}
                  placeholder="サイト名"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={shortcutUrl}
                  onChange={(event) => setShortcutUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-violet-500 px-4 py-2 font-medium text-white transition hover:bg-violet-400"
                >
                  追加する
                </button>
              </form>

              <div className="space-y-3">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center gap-2">
                    <a
                      href={shortcut.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-left transition hover:border-cyan-400/60 hover:bg-slate-800/80"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-xl">{shortcut.emoji}</span>
                        <span className="text-sm font-medium text-slate-100">{shortcut.label}</span>
                      </span>
                      <span className="text-xs text-slate-400">Open</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteShortcut(shortcut.id)}
                      className="rounded-xl border border-slate-700 px-2 py-2 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
