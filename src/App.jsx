import { useState, useEffect, useRef } from "react";

// ── 定数 ──────────────────────────────────────────────────────────────────
const WEEKDAY_LABELS = ['月','火','水','木','金','土','日'];

const defaultTemplates = [
  { id: 't1', title: '薬を飲む', repeatType: 'daily', repeatWeekdays: [] },
  { id: 't2', title: '歯磨き', repeatType: 'none', repeatWeekdays: [] },
  { id: 't3', title: '洗濯', repeatType: 'none', repeatWeekdays: [] },
  { id: 't4', title: 'ゴミ出し', repeatType: 'none', repeatWeekdays: [] },
  { id: 't5', title: '仕事', repeatType: 'none', repeatWeekdays: [] },
];

// ── ユーティリティ ────────────────────────────────────────────────────────
const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const todayLabel = () => { const d = new Date(); const days=['日','月','火','水','木','金','土']; return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`; };
// 今日の曜日（0=月〜6=日）
const todayWeekday = () => { const d = new Date(); return (d.getDay() + 6) % 7; };
const genId = () => Math.random().toString(36).slice(2);

// ── 繰り返しタスクの自動生成 ─────────────────────────────────────────────
// repeatMaster（繰り返し設定の親）を元に今日分を生成する
const generateRepeatTasks = (tasks) => {
  const today = todayStr();
  const wday = todayWeekday();
  const existingTitlesToday = new Set(tasks.filter(t => t.date === today).map(t => t.title));
  const masters = tasks.filter(t => t.repeatType && t.repeatType !== 'none' && t.isMaster);
  const maxOrder = tasks.length ? Math.max(...tasks.map(t => t.order)) : -1;

  const toAdd = [];
  masters.forEach((m, i) => {
    if (existingTitlesToday.has(m.title)) return; // 重複防止
    const should = m.repeatType === 'daily' ||
      (m.repeatType === 'weekly' && m.repeatWeekdays.includes(wday));
    if (!should) return;
    toAdd.push({
      id: genId(), title: m.title, status: 'pending',
      order: maxOrder + 1 + i, date: today, laterCount: 0,
      repeatType: m.repeatType, repeatWeekdays: m.repeatWeekdays,
      isMaster: false, masterId: m.id,
    });
  });
  return toAdd;
};

// ── カラー・スタイル ───────────────────────────────────────────────────────
const C = { bg:'#F7F8FA', card:'#FFFFFF', primary:'#2D7DD2', done:'#34A853', later:'#F9A825', skip:'#E53935', text:'#1A1A1A', sub:'#6B7280', border:'#E8EAED', chip:'#EEF2FF' };

const s = {
  screen: { minHeight:'100dvh', background:C.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic UI",sans-serif', maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' },
  appbar: { padding:'16px 20px 12px', background:C.bg, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' },
  body: { flex:1, overflowY:'auto', padding:'12px 16px' },
  card: { background:C.card, borderRadius:14, border:`1px solid ${C.border}`, marginBottom:8, display:'flex', alignItems:'center', padding:'14px 16px', gap:10 },
  btnPrimary: { width:'100%', height:60, borderRadius:16, background:C.primary, color:'#fff', border:'none', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  btnOutline: { flex:1, height:52, borderRadius:14, background:'transparent', border:`1.5px solid ${C.border}`, fontSize:15, fontWeight:500, color:C.text, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 },
  bottomBar: { padding:'12px 16px 24px', borderTop:`1px solid ${C.border}`, background:C.bg, display:'flex', flexDirection:'column', gap:10 },
};

// ── メインApp ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('today');
  const [tasks, setTasks] = useState(() => {
    const saved = load('tanuki_tasks', []);
    // 起動時に繰り返しタスクを生成
    const toAdd = generateRepeatTasks(saved);
    if (toAdd.length === 0) return saved;
    const next = [...saved, ...toAdd];
    save('tanuki_tasks', next);
    return next;
  });
  const [templates, setTemplates] = useState(() => load('tanuki_templates', defaultTemplates));
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [showLaterDialog, setShowLaterDialog] = useState(false);
  const [skipTaskId, setSkipTaskId] = useState(null);

  const today = todayStr();
  const yesterday = yesterdayStr();
  const tomorrow = tomorrowStr();

  const todayTasks = tasks.filter(t => t.date === today && !t.isMaster).sort((a,b) => a.order - b.order);
  const pendingTasks = todayTasks.filter(t => t.status === 'pending');
  const completedTasks = todayTasks.filter(t => t.status === 'completed');
  const yesterdayTasks = tasks.filter(t => t.date === yesterday && !t.isMaster);
  const tomorrowTasks = tasks.filter(t => t.date === tomorrow && !t.isMaster);
  const unboxTasks = tasks.filter(t => !t.date && !t.isMaster);
  const masterTasks = tasks.filter(t => t.isMaster);
  const currentTask = pendingTasks[0] || null;
  const unboxCount = tomorrowTasks.length + unboxTasks.length;

  const saveTasks = (next) => { setTasks(next); save('tanuki_tasks', next); };
  const saveTemplates = (next) => { setTemplates(next); save('tanuki_templates', next); };

  // 通常タスク追加
  const addTask = (title, repeatType = 'none', repeatWeekdays = []) => {
    const maxOrder = tasks.length ? Math.max(...tasks.map(t=>t.order))+1 : 0;
    const todayTask = { id:genId(), title, status:'pending', order:maxOrder, date:today, laterCount:0, repeatType, repeatWeekdays, isMaster:false };
    const next = [...tasks, todayTask];
    // 繰り返しあり かつ 同タイトルのmasterがまだない場合のみmasterを追加
    const alreadyHasMaster = tasks.some(t => t.isMaster && t.title === title);
    if (repeatType !== 'none' && !alreadyHasMaster) {
      next.push({ id:genId(), title, status:'pending', order:maxOrder+1, date:null, laterCount:0, repeatType, repeatWeekdays, isMaster:true });
    }
    saveTasks(next);
  };

  // テンプレートから追加（今日すでに同タイトルがある場合はスキップ）
  const addTaskFromTemplate = (title, repeatType, repeatWeekdays) => {
    const alreadyToday = tasks.some(t => t.date === today && t.title === title && !t.isMaster);
    if (alreadyToday) return; // 重複追加しない
    addTask(title, repeatType, repeatWeekdays);
  };

  const deleteTask = (id) => saveTasks(tasks.filter(t => t.id !== id));
  const deleteMaster = (id) => saveTasks(tasks.filter(t => t.id !== id && t.masterId !== id));

  // テンプレート削除：同タイトルのmasterタスクも同時に削除する
  const deleteTemplate = (id) => {
    const template = templates.find(t => t.id === id);
    if (!template) return saveTemplates(templates.filter(t => t.id !== id));
    // 同タイトルのmasterを削除（今日分の通常タスクは残す）
    saveTasks(tasks.filter(t => !(t.isMaster && t.title === template.title)));
    saveTemplates(templates.filter(t => t.id !== id));
  };

  const moveToToday = (id) => {
    const maxOrder = tasks.length ? Math.max(...tasks.map(t=>t.order))+1 : 0;
    saveTasks(tasks.map(t => t.id===id ? {...t, date:today, status:'pending', laterCount:0, order:maxOrder} : t));
  };

  const moveTask = (id, dir) => {
    const sorted = [...todayTasks].sort((a,b) => a.order - b.order);
    const idx = sorted.findIndex(t => t.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const aOrder = sorted[idx].order;
    const bOrder = sorted[swapIdx].order;
    saveTasks(tasks.map(t => {
      if (t.id === sorted[idx].id) return {...t, order:bOrder};
      if (t.id === sorted[swapIdx].id) return {...t, order:aOrder};
      return t;
    }));
  };

  const completeTask = (id) => saveTasks(tasks.map(t => t.id===id ? {...t, status:'completed', laterCount:0} : t));

  const laterTask = (id) => {
    const task = tasks.find(t => t.id===id);
    if (!task) return;
    const newCount = task.laterCount + 1;
    const maxOrder = tasks.filter(t=>t.date===today&&t.status==='pending').reduce((m,t)=>Math.max(m,t.order),0);
    saveTasks(tasks.map(t => t.id===id ? {...t, laterCount:newCount, order:maxOrder+1} : t));
    if (newCount >= 3) setShowLaterDialog(true);
  };

  const skipTask = (id, dest) => {
    if (dest === 'tomorrow') saveTasks(tasks.map(t => t.id===id ? {...t, date:tomorrow, status:'pending', laterCount:0} : t));
    else if (dest === 'unbox') saveTasks(tasks.map(t => t.id===id ? {...t, date:null, status:'pending', laterCount:0, isMaster:false} : t));
    setShowSkipDialog(false); setShowLaterDialog(false); setSkipTaskId(null);
  };

  const copyYesterday = () => {
    const existTitles = new Set(todayTasks.map(t=>t.title));
    // 繰り返しタスクは自動生成されるためコピー対象から除外
    const toAdd = yesterdayTasks.filter(t => !existTitles.has(t.title) && t.repeatType === 'none');
    const maxOrder = tasks.length ? Math.max(...tasks.map(t=>t.order)) : -1;
    saveTasks([...tasks, ...toAdd.map((t,i) => ({id:genId(), title:t.title, status:'pending', order:maxOrder+1+i, date:today, laterCount:0, repeatType:'none', repeatWeekdays:[], isMaster:false}))]);
  };

  useEffect(() => {
    if (screen==='execution' && pendingTasks.length===0) setScreen('done');
  }, [pendingTasks.length, screen]);

  if (screen==='today') return (
    <TodayScreen
      todayTasks={todayTasks} yesterdayTasks={yesterdayTasks}
      onAddTask={addTask} onAddTaskFromTemplate={addTaskFromTemplate} onDeleteTask={deleteTask} onMoveTask={moveTask}
      onStart={() => setScreen('execution')} onSettings={() => setScreen('settings')}
      onCopyYesterday={copyYesterday}
      showAddSheet={showAddSheet} setShowAddSheet={setShowAddSheet}
      templates={templates} unboxCount={unboxCount}
      onShowInbox={() => setScreen('inbox')}
    />
  );
  if (screen==='execution') return (
    <ExecutionScreen
      currentTask={currentTask} completedCount={completedTasks.length} totalCount={todayTasks.length}
      onBack={() => setScreen('today')}
      onDone={() => completeTask(currentTask?.id)}
      onLater={() => laterTask(currentTask?.id)}
      onSkip={() => { setSkipTaskId(currentTask?.id); setShowSkipDialog(true); }}
      showSkipDialog={showSkipDialog} showLaterDialog={showLaterDialog}
      onSkipChoice={(dest) => skipTask(skipTaskId || currentTask?.id, dest)}
      onLaterChoice={(choice) => {
        if (choice==='skip') { setShowLaterDialog(false); setShowSkipDialog(true); setSkipTaskId(currentTask?.id); }
        else setShowLaterDialog(false);
      }}
    />
  );
  if (screen==='done') return <DoneScreen completedTasks={completedTasks} onBack={() => setScreen('today')} />;
  if (screen==='inbox') return <InboxScreen tomorrowTasks={tomorrowTasks} unboxTasks={unboxTasks} onBack={() => setScreen('today')} onMoveToToday={moveToToday} onDelete={deleteTask} />;
  if (screen==='repeats') return <RepeatScreen masterTasks={masterTasks} onBack={() => setScreen('settings')} onDelete={deleteMaster} />;
  if (screen==='templates') return <TemplatesScreen templates={templates} onBack={() => setScreen('settings')} onAdd={(t,r,w)=>saveTemplates([...templates,{id:genId(),title:t,repeatType:r,repeatWeekdays:w}])} onDelete={deleteTemplate} />;
  if (screen==='settings') return <SettingsScreen onBack={() => setScreen('today')} onTemplates={() => setScreen('templates')} onRepeats={() => setScreen('repeats')} repeatCount={masterTasks.length} />;
}

// ── 今日のタスク一覧画面 ──────────────────────────────────────────────────
function TodayScreen({ todayTasks, yesterdayTasks, onAddTask, onAddTaskFromTemplate, onDeleteTask, onMoveTask, onStart, onSettings, onCopyYesterday, showAddSheet, setShowAddSheet, templates, unboxCount, onShowInbox }) {
  return (
    <div style={s.screen}>
      <div style={s.appbar}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:-0.3 }}>Tanuki</div>
          <div style={{ fontSize:13, color:C.sub, marginTop:2 }}>{todayLabel()}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={onShowInbox} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', fontSize:20, padding:8 }}>
            📥
            {unboxCount > 0 && (
              <span style={{ position:'absolute', top:4, right:4, background:C.skip, color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{unboxCount}</span>
            )}
          </button>
          <button onClick={onSettings} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:8 }}>⚙️</button>
        </div>
      </div>

      <div style={s.body}>
        {yesterdayTasks.length > 0 && (
          <div style={{ background:'#EEF2FF', borderRadius:14, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:14, color:'#3730A3' }}>昨日のタスクが{yesterdayTasks.length}件あります</span>
            <button onClick={onCopyYesterday} style={{ background:'none', border:'none', color:'#3730A3', fontWeight:700, fontSize:14, cursor:'pointer' }}>コピー</button>
          </div>
        )}
        {todayTasks.length === 0 ? (
          <div style={{ textAlign:'center', paddingTop:80, color:C.sub }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✓</div>
            <div style={{ fontSize:15 }}>今日のタスクはまだありません</div>
          </div>
        ) : (
          todayTasks.map((task, idx) => (
            <TaskItem key={task.id} task={task}
              isFirst={idx===0} isLast={idx===todayTasks.length-1}
              onDelete={() => onDeleteTask(task.id)}
              onMoveUp={() => onMoveTask(task.id, -1)}
              onMoveDown={() => onMoveTask(task.id, 1)}
            />
          ))
        )}
      </div>

      <div style={s.bottomBar}>
        <button onClick={() => setShowAddSheet(true)} style={{ ...s.btnOutline, flex:'none', width:'100%' }}>
          <span style={{ fontSize:18 }}>＋</span> タスクを追加
        </button>
        {todayTasks.length > 0 && (
          <button onClick={onStart} style={s.btnPrimary}><span>▶</span> 今日を始める</button>
        )}
      </div>

      {showAddSheet && (
        <AddTaskSheet templates={templates}
          onAdd={(title) => { onAddTask(title, 'none', []); setShowAddSheet(false); }}
          onAddFromTemplate={(title, repeatType, repeatWeekdays) => { onAddTaskFromTemplate(title, repeatType, repeatWeekdays); setShowAddSheet(false); }}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  );
}

// ── タスク行 ──────────────────────────────────────────────────────────────
function TaskItem({ task, isFirst, isLast, onDelete, onMoveUp, onMoveDown }) {
  const isCompleted = task.status === 'completed';
  const repeatLabel = task.repeatType === 'daily' ? '毎日'
    : task.repeatType === 'weekly' ? `毎週${task.repeatWeekdays.map(w=>WEEKDAY_LABELS[w]).join('・')}`
    : null;
  return (
    <div style={{ ...s.card, opacity:isCompleted?0.5:1, flexWrap:'wrap' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        <button onClick={onMoveUp} disabled={isFirst} style={{ background:'none', border:'none', cursor:isFirst?'default':'pointer', color:isFirst?'#ddd':C.sub, fontSize:16, padding:'2px 6px', lineHeight:1 }}>▲</button>
        <button onClick={onMoveDown} disabled={isLast} style={{ background:'none', border:'none', cursor:isLast?'default':'pointer', color:isLast?'#ddd':C.sub, fontSize:16, padding:'2px 6px', lineHeight:1 }}>▼</button>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:16, color:C.text, textDecoration:isCompleted?'line-through':'none' }}>{task.title}</div>
        {repeatLabel && <div style={{ fontSize:11, color:C.primary, marginTop:2 }}>🔁 {repeatLabel}</div>}
      </div>
      {isCompleted && <span style={{ fontSize:13, color:C.done }}>✅</span>}
      <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:18, padding:4 }}>✕</button>
    </div>
  );
}

// ── タスク追加シート ──────────────────────────────────────────────────────
function AddTaskSheet({ templates, onAdd, onAddFromTemplate, onClose }) {
  const [input, setInput] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = () => { const t = input.trim(); if (t) onAdd(t, 'none', []); };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} />
      <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.card, borderRadius:'24px 24px 0 0', padding:'20px 20px 32px', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:16, color:C.text }}>タスクを追加</div>

        {/* テキスト入力 */}
        <input ref={ref} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&submit()}
          placeholder="タスク名を入力..."
          style={{ width:'100%', height:52, borderRadius:12, border:`1.5px solid ${C.border}`, padding:'0 16px', fontSize:16, outline:'none', boxSizing:'border-box', background:'#F7F8FA' }}
        />

        {/* テンプレート（繰り返し設定はここから） */}
        {templates.length > 0 && (
          <>
            <div style={{ fontSize:12, color:C.sub, margin:'14px 0 8px', letterSpacing:0.5 }}>
              テンプレートから選ぶ
              <span style={{ marginLeft:6, color:C.primary }}>（繰り返し設定あり）</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {templates.map(t => (
                <button key={t.id} onClick={()=>onAddFromTemplate(t.title, t.repeatType||'none', t.repeatWeekdays||[])}
                  style={{ background:C.chip, border:'none', borderRadius:20, padding:'7px 14px', fontSize:14, color:C.primary, cursor:'pointer', fontWeight:500, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span>{t.title}</span>
                  {t.repeatType==='daily' && <span style={{ fontSize:10, color:C.sub }}>🔁 毎日</span>}
                  {t.repeatType==='weekly' && t.repeatWeekdays?.length > 0 && <span style={{ fontSize:10, color:C.sub }}>🔁 {t.repeatWeekdays.map(w=>WEEKDAY_LABELS[w]).join('・')}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={submit} style={{ ...s.btnPrimary, height:52, borderRadius:14, fontSize:16 }}>
          追加する
        </button>
      </div>
    </div>
  );
}

// ── タスク実行画面 ────────────────────────────────────────────────────────
function ExecutionScreen({ currentTask, completedCount, totalCount, onBack, onDone, onLater, onSkip, showSkipDialog, showLaterDialog, onSkipChoice, onLaterChoice }) {
  if (!currentTask) return null;
  return (
    <div style={s.screen}>
      <div style={{ ...s.appbar, justifyContent:'space-between' }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.sub }}>← 戻る</button>
        <span style={{ fontSize:15, fontWeight:500, color:C.sub }}>{completedCount} / {totalCount}</span>
        <div style={{ width:60 }} />
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 32px' }}>
        <div style={{ fontSize:38, fontWeight:700, color:C.text, textAlign:'center', letterSpacing:-0.5, lineHeight:1.25 }}>{currentTask.title}</div>
      </div>
      <div style={{ padding:'16px 20px 32px', display:'flex', flexDirection:'column', gap:12 }}>
        <button onClick={onDone} style={{ ...s.btnPrimary, height:68, fontSize:20, background:C.done, borderRadius:18 }}>✅ 終わった</button>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={onLater} style={{ ...s.btnOutline, border:`1.5px solid ${C.later}`, color:C.later }}>🟡 あとで</button>
          <button onClick={onSkip} style={{ ...s.btnOutline, border:`1.5px solid ${C.skip}`, color:C.skip }}>🔴 今日は無理</button>
        </div>
      </div>
      {showSkipDialog && <Dialog title="今日は無理ですね 😊" message="このタスクをどうしますか？" actions={[
        { label:'明日に移動する', onClick:()=>onSkipChoice('tomorrow'), primary:true },
        { label:'あとで考える', onClick:()=>onSkipChoice('unbox') },
        { label:'キャンセル', onClick:()=>onSkipChoice('cancel'), text:true },
      ]} />}
      {showLaterDialog && <Dialog title="このタスク、難しそうですか？ 🤔" message="「あとで」が続いています。今日は無理にしてもいいですよ。" actions={[
        { label:'今日は無理にする', onClick:()=>onLaterChoice('skip'), primary:true },
        { label:'このまま続ける', onClick:()=>onLaterChoice('keep'), text:true },
      ]} />}
    </div>
  );
}

// ── 完了画面 ──────────────────────────────────────────────────────────────
function DoneScreen({ completedTasks, onBack }) {
  return (
    <div style={s.screen}>
      <div style={{ flex:1, padding:'64px 24px 24px' }}>
        <div style={{ fontSize:28, fontWeight:700, color:C.text, lineHeight:1.4, letterSpacing:-0.5, marginBottom:32 }}>よくがんばりました。<br />あとは休むだけです。</div>
        <div style={{ height:1, background:C.border, marginBottom:20 }} />
        {completedTasks.length > 0 && (
          <>
            <div style={{ fontSize:12, color:C.sub, letterSpacing:0.8, marginBottom:12 }}>完了したタスク</div>
            {completedTasks.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
                <span>✅</span><span style={{ fontSize:16, color:C.text }}>{t.title}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={s.bottomBar}><button onClick={onBack} style={s.btnPrimary}>一覧に戻る</button></div>
    </div>
  );
}

// ── 未処理・明日の確認画面 ────────────────────────────────────────────────
function InboxScreen({ tomorrowTasks, unboxTasks, onBack, onMoveToToday, onDelete }) {
  const isEmpty = tomorrowTasks.length===0 && unboxTasks.length===0;
  return (
    <div style={s.screen}>
      <div style={s.appbar}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.sub }}>← 戻る</button>
        <div style={{ fontSize:18, fontWeight:700, color:C.text }}>あとで・明日</div>
        <div style={{ width:60 }} />
      </div>
      <div style={s.body}>
        {isEmpty ? (
          <div style={{ textAlign:'center', paddingTop:80, color:C.sub }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:15 }}>持ち越したタスクはありません</div>
          </div>
        ) : (
          <>
            {tomorrowTasks.length > 0 && <>
              <div style={{ fontSize:12, color:C.sub, letterSpacing:0.8, padding:'4px 4px 8px', fontWeight:600 }}>明日に移動したタスク</div>
              {tomorrowTasks.map(t => <InboxItem key={t.id} task={t} onMoveToToday={()=>onMoveToToday(t.id)} onDelete={()=>onDelete(t.id)} />)}
            </>}
            {unboxTasks.length > 0 && <>
              <div style={{ fontSize:12, color:C.sub, letterSpacing:0.8, padding:'16px 4px 8px', fontWeight:600 }}>あとで考えるタスク</div>
              {unboxTasks.map(t => <InboxItem key={t.id} task={t} onMoveToToday={()=>onMoveToToday(t.id)} onDelete={()=>onDelete(t.id)} />)}
            </>}
          </>
        )}
      </div>
    </div>
  );
}

function InboxItem({ task, onMoveToToday, onDelete }) {
  return (
    <div style={s.card}>
      <span style={{ flex:1, fontSize:16, color:C.text }}>{task.title}</span>
      <button onClick={onMoveToToday} style={{ background:C.chip, border:'none', borderRadius:20, padding:'6px 12px', fontSize:13, color:C.primary, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>今日やる</button>
      <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:18, padding:4 }}>✕</button>
    </div>
  );
}

// ── 繰り返し管理画面 ──────────────────────────────────────────────────────
function RepeatScreen({ masterTasks, onBack, onDelete }) {
  return (
    <div style={s.screen}>
      <div style={s.appbar}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.sub }}>← 戻る</button>
        <div style={{ fontSize:18, fontWeight:700, color:C.text }}>繰り返しタスク</div>
        <div style={{ width:60 }} />
      </div>
      <div style={s.body}>
        {masterTasks.length === 0 ? (
          <div style={{ textAlign:'center', paddingTop:80, color:C.sub }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔁</div>
            <div style={{ fontSize:15 }}>繰り返しタスクはありません</div>
            <div style={{ fontSize:13, marginTop:8 }}>設定 → テンプレート管理 から繰り返し付きテンプレートを追加すると登録されます</div>
          </div>
        ) : (
          masterTasks.map(t => {
            const label = t.repeatType==='daily' ? '毎日'
              : `毎週 ${t.repeatWeekdays.map(w=>WEEKDAY_LABELS[w]).join('・')}`;
            return (
              <div key={t.id} style={s.card}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, color:C.text }}>{t.title}</div>
                  <div style={{ fontSize:12, color:C.primary, marginTop:2 }}>🔁 {label}</div>
                </div>
                <button onClick={()=>onDelete(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.skip, fontSize:18 }}>🗑</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── テンプレート管理画面 ──────────────────────────────────────────────────
function TemplatesScreen({ templates, onBack, onAdd, onDelete }) {
  const [input, setInput] = useState('');
  const [repeatType, setRepeatType] = useState('none');
  const [repeatWeekdays, setRepeatWeekdays] = useState([]);
  const toggleWeekday = (w) => setRepeatWeekdays(prev => prev.includes(w) ? prev.filter(x=>x!==w) : [...prev, w]);

  return (
    <div style={s.screen}>
      <div style={s.appbar}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.sub }}>← 戻る</button>
        <div style={{ fontSize:18, fontWeight:700, color:C.text }}>テンプレート</div>
        <div style={{ width:60 }} />
      </div>
      <div style={s.body}>
        {templates.map(t => {
          const label = t.repeatType==='daily'?' 🔁毎日' : t.repeatType==='weekly'?` 🔁${t.repeatWeekdays?.map(w=>WEEKDAY_LABELS[w]).join('・')}` : '';
          return (
            <div key={t.id} style={s.card}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, color:C.text }}>{t.title}</div>
                {label && <div style={{ fontSize:11, color:C.primary, marginTop:2 }}>{label}</div>}
              </div>
              <button onClick={()=>onDelete(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.skip, fontSize:18 }}>🗑</button>
            </div>
          );
        })}
      </div>
      <div style={s.bottomBar}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          placeholder="テンプレート名..."
          style={{ width:'100%', height:48, borderRadius:12, border:`1.5px solid ${C.border}`, padding:'0 14px', fontSize:15, outline:'none', background:'#F7F8FA', boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:8 }}>
          {[['none','なし'],['daily','毎日'],['weekly','曜日']].map(([val,label])=>(
            <button key={val} onClick={()=>{ setRepeatType(val); if(val!=='weekly') setRepeatWeekdays([]); }}
              style={{ flex:1, height:36, borderRadius:10, border:`1.5px solid ${repeatType===val?C.primary:C.border}`, background:repeatType===val?C.chip:'transparent', color:repeatType===val?C.primary:C.sub, fontSize:13, fontWeight:repeatType===val?700:400, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        {repeatType==='weekly' && (
          <div style={{ display:'flex', gap:6 }}>
            {WEEKDAY_LABELS.map((label,i)=>(
              <button key={i} onClick={()=>toggleWeekday(i)}
                style={{ flex:1, height:34, borderRadius:8, border:`1.5px solid ${repeatWeekdays.includes(i)?C.primary:C.border}`, background:repeatWeekdays.includes(i)?C.primary:'transparent', color:repeatWeekdays.includes(i)?'#fff':C.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <button onClick={()=>{ if(input.trim()){ onAdd(input.trim(), repeatType, repeatWeekdays); setInput(''); setRepeatType('none'); setRepeatWeekdays([]); }}}
          style={{ ...s.btnPrimary, height:52, borderRadius:14, fontSize:16 }}>追加</button>
      </div>
    </div>
  );
}

// ── 設定画面 ──────────────────────────────────────────────────────────────
function SettingsScreen({ onBack, onTemplates, onRepeats, repeatCount }) {
  return (
    <div style={s.screen}>
      <div style={s.appbar}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.sub }}>← 戻る</button>
        <div style={{ fontSize:18, fontWeight:700, color:C.text }}>設定</div>
        <div style={{ width:60 }} />
      </div>
      <div style={s.body}>
        <div style={{ fontSize:12, color:C.sub, letterSpacing:0.8, padding:'8px 4px 4px' }}>タスク</div>
        <div onClick={onRepeats} style={{ ...s.card, cursor:'pointer' }}>
          <span style={{ flex:1, fontSize:16, color:C.text }}>繰り返しタスク</span>
          {repeatCount > 0 && <span style={{ fontSize:13, color:C.primary, fontWeight:600 }}>{repeatCount}件</span>}
          <span style={{ color:C.sub }}>›</span>
        </div>
        <div onClick={onTemplates} style={{ ...s.card, cursor:'pointer' }}>
          <span style={{ flex:1, fontSize:16, color:C.text }}>テンプレート管理</span>
          <span style={{ color:C.sub }}>›</span>
        </div>
        <div style={{ fontSize:12, color:C.sub, letterSpacing:0.8, padding:'16px 4px 4px' }}>データ</div>
        <div style={{ ...s.card, color:C.sub, fontSize:15 }}>データはこのブラウザに保存されます</div>
      </div>
    </div>
  );
}

// ── 共通ダイアログ ────────────────────────────────────────────────────────
function Dialog({ title, message, actions }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} />
      <div style={{ position:'relative', width:'100%', maxWidth:480, background:C.card, borderRadius:'24px 24px 0 0', padding:'24px 20px 32px' }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>{title}</div>
        <div style={{ fontSize:15, color:C.sub, marginBottom:20, lineHeight:1.5 }}>{message}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {actions.map((a,i) => (
            <button key={i} onClick={a.onClick} style={
              a.primary ? { ...s.btnPrimary, height:52, borderRadius:12, fontSize:16 }
              : a.text ? { background:'none', border:'none', height:48, fontSize:15, color:C.sub, cursor:'pointer' }
              : { ...s.btnOutline, flex:'none', width:'100%' }
            }>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
