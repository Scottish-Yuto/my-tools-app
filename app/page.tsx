"use client"
// useState：一時的なメモリ、useFffect：特定のタイミングに、自動で処理を走らせる機能
import { useState, useEffect, memo } from "react";

export default function Home() {
  // タスクのデータを記憶するState
  const [tasks, setTasks] = useState([
    { id: 1, text: "mahorobaの次回の企画書を作る", isDone: false },
    { id: 2, text: "上映予定の映画リストをまとめる", isDone: false },
  ]);
  const [inputText, setInputText] = useState("");
  // メモのデータを記憶するState
  const [memoText, setMemoText] = useState("");

  // 特有のエラーを防ぐためのフラグ
  const [isMounted, setIsMounted] = useState(false);

  // アプリ起動時にブラウザの保存箱からデータを読み込む
  useEffect(() => {
    const savedTasks = localStorage.getItem("my-app-tasks");
    const savedMemo = localStorage.getItem("my-app-memo");

    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    if (savedMemo) {
      setMemoText(savedMemo);
    }
    setIsMounted(true);
  }, []);

  // タスクが更新されるたびに、ブラウザの保存箱に保存
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("my-app-tasks", JSON.stringify(tasks));
    }
  }, [tasks, isMounted]);

  // タスクが更新されるたびに、ブラウザの保存箱に保存
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("my-app-memo", memoText);
    }
  }, [memoText, isMounted]);

  // チェックボックスの処理
  const toggleTask = (taskId: number) => {
    const newTasks = tasks.map((task) => {
      if(task.id === taskId) {
        // クリックされたタスクだけ、完了状態を反転させる
        return { ...task, isDone: !task.isDone };
      }
      return task;
    });
    setTasks(newTasks);
  }

  // 追加ボタンの処理
  const addTask = (e: React.FormEvent) => {
    e.preventDefault();

    // 空欄のままなら何もしない
    if(inputText.trim() === "") 
      return;

    // 新しいタスクのデータを作成
    const newTask = {
      id: Date.now(),
      text: inputText,
      isDone: false,
    };
    // 今のタスク一覧の最後に、新しいタスクを挿入
    setTasks([...tasks, newTask]);
    // 入力欄を空に
    setInputText("");
  };

  // タスクの削除
  const deleteTask = (taskId: number) => {
    const newTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(newTasks);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      {/* タイトル */}
      <h1 className="text-2xl font-bold mb-6 text-gray-800">My Terminal</h1>
      
      <div className="flex gap-6 h-[85vh]">
        {/* 左側：カレンダーエリア */}
        <div className="flex-1 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">📅 カレンダー</h2>
          <p className="text-gray-500">（ここにカレンダーが入ります）</p>
        </div>

        {/* 右側：タスクとメモエリア */}
        <div className="w-1/3 flex flex-col gap-6">
          {/* 右上：タスクエリア */}
          <div className="flex-1 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2" >✅ タスク</h2>

            {/* タスク入力フォーム */}
            <form onSubmit={addTask} className="flex gap-2 mb-4">
              <input 
                type="text" 
                className="flex-1 w-full border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 text-gray-900 font-medium"
                placeholder="タスクを追加"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                type="submit"
                className="w-24 shrink-0 bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  追加
                </button>
            </form>

            {/* タスクリスト（スクロール） */}
            <ul className="space-y-3 overflow-y-auto">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 cursor-pointer accent-blue-500 shrink-0"
                    checked={task.isDone}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className={task.isDone ? "line-through text-gray-400" : "text-gray-900 font-medium"}>
                    {task.text}
                  </span>
                  {/* 削除ボタン */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors shrink-0"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 右下：メモエリア */}
          <div className="flex-1 flex-col bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">📝 メモ</h2>
            <textarea
              className="flex-1 w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-none text-gray-900 font-medium"
              placeholder="メモ"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
            />
          </div>
          
        </div>
      </div>
    </main>
  );
}