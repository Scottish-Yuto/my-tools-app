// 「このファイルはブラウザで動く処理を使う」と宣言するための合図
"use client";

// React の機能を読み込む
// useState: 画面で使うデータを保持
// useEffect: 画面の表示時や値の変化時に処理を実行
// useMemo: 何度も計算しないように、必要なときだけ結果を返す
import { useEffect, useMemo, useState } from "react";

// タスクの優先度の種類を決める
// 高・中・低で管理する
type TaskPriority = "high" | "medium" | "low";
type TaskFilter = "all" | "active" | "done";

// タスクの型を定義
// done: 完了したかどうか
// priority: 優先度
type Task = {
  id: number;
  text: string;
  done: boolean;
  priority: TaskPriority;
};

// よく使うリンクの型を定義
// label: 表示する名前, url: 行き先のURL, emoji: アイコン
type Shortcut = {
  id: number;
  label: string;
  url: string;
  emoji: string;
};

const priorityOrder: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const priorityLabel: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// 最初に表示するサンプルのタスク
// 画面を開いたときに何が表示されるかをすぐ確認できるようにする
const defaultTasks: Task[] = [
  { id: 1, text: "デザイン案をまとめる", done: false, priority: "high" },
  { id: 2, text: "明日の会議資料を確認する", done: true, priority: "medium" },
  { id: 3, text: "買い物リストを見直す", done: false, priority: "low" },
];

// 最初に表示するよく使うリンク
const defaultShortcuts: Shortcut[] = [
  { id: 1, label: "Gmail", url: "https://mail.google.com", emoji: "✉️" },
  { id: 2, label: "Notion", url: "https://www.notion.so", emoji: "📝" },
  { id: 3, label: "GitHub", url: "https://github.com", emoji: "💻" },
];

// カレンダーの曜日の並びを決める配列
const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

// 指定した月のカレンダーを作る関数
// 1日が何曜日から始まるかを計算し、前の月の空白も含めて 42 日分を並べる
const getCalendarDays = (baseDate: Date) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  // カレンダーの始まりを週の最初に合わせる
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());

  const days: Date[] = [];

  // 6週間分の42日を用意
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    days.push(date);
  }

  return days;
};

// 本体
// Reactコンポーネントとして画面を作る
export default function Home() {
  // state を定義する
  // tasks: タスクの一覧
  // inputText: タスク入力欄に入っている文字
  // memoText: メモの内容
  // shortcuts: よく使うリンクの一覧
  // shortcutLabel: リンク名の入力値
  // shortcutUrl: URL の入力値
  // isReady: 保存データを読み込んだかどうか
  // now: 現在の時間
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [memoText, setMemoText] = useState("");
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("");
  const [shortcutUrl, setShortcutUrl] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [now, setNow] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());

  // 最初にページが開かれたとき、ブラウザに保存されているデータを取り出す
  // localStorage はブラウザの保存箱のようなもの
  useEffect(() => {
    const savedTasks = localStorage.getItem("my-tools-tasks");
    const savedMemo = localStorage.getItem("my-tools-memo");
    const savedShortcuts = localStorage.getItem("my-tools-shortcuts");

    // 保存データがあれば使う。なければ最初のデータを使う
    const loadedTasks = savedTasks ? JSON.parse(savedTasks) : defaultTasks;
    setTasks(
      loadedTasks.map((task: Partial<Task>) => ({
        id: task.id ?? Date.now(),
        text: task.text ?? "",
        done: Boolean(task.done),
        priority: task.priority ?? "medium",
      })),
    );
    setMemoText(savedMemo ?? "");
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
    localStorage.setItem("my-tools-memo", memoText);
  }, [memoText, isReady]);

  // リンク一覧が変わったら、ブラウザに保存する
  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("my-tools-shortcuts", JSON.stringify(shortcuts));
  }, [shortcuts, isReady]);

  // カレンダーを表示するために、必要な日付を計算する
  const monthDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate]);
  const currentMonth = calendarDate.getMonth();
  const currentYear = calendarDate.getFullYear();

  // 完了したタスクの数を数える
  const completedCount = tasks.filter((task) => task.done).length;

  // 進捗率を計算する
  // 例: 2 / 4 = 50%
  const progressRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (taskFilter === "active") return !task.done;
      if (taskFilter === "done") return task.done;
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (left.done !== right.done) return Number(left.done) - Number(right.done);
      return priorityOrder[right.priority] - priorityOrder[left.priority];
    });
  }, [tasks, taskFilter]);

  const changeMonth = (offset: number) => {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const resetCalendarToToday = () => {
    setCalendarDate(new Date(now));
  };

  // タスクを追加する処理
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
        done: false,
        priority: taskPriority,
      },
    ]);

    // 入力欄を空に
    setInputText("");
    setTaskPriority("medium");
  };

  // タスクの完了状態を切り替える処理
  const toggleTask = (taskId: number) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  };

  // 指定したタスクを削除する処理
  const deleteTask = (taskId: number) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  };

  // メモを消す処理
  const clearMemo = () => {
    setMemoText("");
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

  // リンクを削除する処理
  const deleteShortcut = (shortcutId: number) => {
    setShortcuts((currentShortcuts) => currentShortcuts.filter((shortcut) => shortcut.id !== shortcutId));
  };

  // HTML ---------------------------------------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー部分。ページのタイトルと現在時刻を表示する */}
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">MY TOOLS</p>
            <h1 className="mt-2 text-3xl font-bold text-white">今日の作業台</h1>
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
          </div>
        </header>

        {/* 3 つのカードで、進捗状況を一目で確認できるようにする */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
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
            <p className="mt-3 text-3xl font-bold text-white">{memoText.trim() ? "記録済み" : "未記入"}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            {/* 左側の大きいエリア。カレンダーとタスクを並べて表示する */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-white">📅 カレンダー</h2>
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

              {/* 曜日を並べる行 */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wider text-slate-400">
                {weekdayNames.map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* 1か月分の日付を並べて表示する */}
              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthDays.map((date) => {
                  // 今の月に入っている日かどうかを判定する
                  const isCurrentMonth = date.getMonth() === currentMonth;

                  // 今日の日付かどうかも判定する
                  const isToday =
                    date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();

                  return (
                    <div
                      key={`${date.toISOString()}-${date.getDate()}`}
                      className={[
                        "flex h-12 items-center justify-center rounded-xl border text-sm",
                        isCurrentMonth ? "border-slate-700 bg-slate-800/80 text-slate-100" : "border-slate-800 bg-slate-900/50 text-slate-500",
                        isToday ? "border-cyan-400 bg-cyan-500/20 font-bold text-cyan-200" : "",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* タスク一覧を表示するエリア */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">✅ タスク</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "すべて" },
                    { value: "active", label: "未完了" },
                    { value: "done", label: "完了済み" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setTaskFilter(filter.value as TaskFilter)}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs transition",
                        taskFilter === filter.value
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700",
                      ].join(" ")}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* タスクを追加する入力フォーム */}
              <form onSubmit={addTask} className="mb-5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="新しいタスクを入力"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <select
                  value={taskPriority}
                  onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-400"
                >
                  追加
                </button>
              </form>

              {/* タスク一覧を表示する */}
              <ul className="space-y-3">
                {visibleTasks.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                    表示するタスクがありません
                  </li>
                ) : (
                  visibleTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        className="h-5 w-5 accent-cyan-500"
                      />
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          task.priority === "high"
                            ? "bg-rose-500/20 text-rose-200"
                            : task.priority === "medium"
                              ? "bg-amber-500/20 text-amber-200"
                              : "bg-emerald-500/20 text-emerald-200",
                        ].join(" ")}
                      >
                        {priorityLabel[task.priority]}
                      </span>
                      <span
                        className={[
                          "flex-1 text-sm",
                          task.done ? "text-slate-500 line-through" : "text-slate-100",
                        ].join(" ")}
                      >
                        {task.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-lg px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        削除
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <aside className="space-y-6">
            {/* 右側のメモ書きエリア */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">📝 メモ</h2>
                <button
                  type="button"
                  onClick={clearMemo}
                  className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                >
                  クリア
                </button>
              </div>
              <textarea
                value={memoText}
                onChange={(event) => setMemoText(event.target.value)}
                placeholder="今日の気づきやメモを残そう"
                className="h-60 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </section>

            {/* よく使うサイトを登録して、ワンクリックで開けるようにする */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/30">
              <h2 className="mb-4 text-xl font-semibold text-white">⚡ クイックアクセス</h2>

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
          </aside>
        </div>
      </div>
    </main>
  );
}
