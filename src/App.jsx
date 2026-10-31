import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Send, Loader2, AlertCircle, ShieldCheck, Pencil } from 'lucide-react';
import { FORMSPREE_ENDPOINT } from './config';
import {
  AGE_OPTIONS, INSTRUMENT_OPTIONS, LEARNING_STATUS_OPTIONS, SHEET_READING_OPTIONS, SKILL_OPTIONS,
  GOAL_OPTIONS, DEADLINE_OPTIONS, TOPIC_OPTIONS, PAIN_POINT_OPTIONS, STYLE_OPTIONS,
  EXCLUSIVE_OPTION, MAX_SELECT,
} from './questions';

const STEP_LABELS = ['基本資料', '目前基礎', '學習目標', '困難與期待', '確認送出'];
const LAST_STEP = STEP_LABELS.length; // 步驟 1～5，0 是歡迎頁

const INITIAL_FORM = {
  name: '', contact: '', ageGroup: '',
  instruments: [], instrumentOther: '', experienceYears: '', learningStatus: '',
  sheetReading: '', skills: [],
  primaryGoals: [], primaryGoalOther: '', deadline: '', targetDate: '', topics: [],
  painPoints: [], painPointOther: '', specificRoadblock: '', desiredSong: '',
  learningStyles: [], additionalNotes: '',
};

// ──────────────────────────────────────────────
// 把表單資料整理成「中文欄位名稱 → 答案」，Email 裡會照這個順序顯示
// ──────────────────────────────────────────────
function toReadableFields(f) {
  const hasInstrument = f.instruments.length > 0 && !f.instruments.includes(EXCLUSIVE_OPTION.instruments);
  // 把「其他」換成學生填寫的內容，例如「其他：口琴」
  const join = (arr, other) => arr.map((v) => (v.startsWith('其他') && other.trim() ? `其他：${other.trim()}` : v)).join('；');
  return {
    '稱呼': f.name,
    '聯絡方式': f.contact,
    '年齡區間': f.ageGroup,
    '樂器經驗': join(f.instruments, f.instrumentOther),
    '學習年資': hasInstrument ? f.experienceYears || '未填' : '—',
    '目前學習狀態': hasInstrument ? f.learningStatus || '未填' : '—',
    '五線譜閱讀': f.sheetReading,
    '目前做得到的事': f.skills.join('；'),
    '主要學習目標': join(f.primaryGoals, f.primaryGoalOther),
    '時間壓力': f.deadline ? f.deadline + (f.targetDate ? `（目標日期 ${f.targetDate}）` : '') : '未填',
    '有興趣的主題': f.topics.join('；') || '未填',
    '目前的困難': join(f.painPoints, f.painPointOther),
    '具體卡關情境': f.specificRoadblock || '未填',
    '想分析的曲子': f.desiredSong || '未填',
    '偏好學習方式': f.learningStyles.join('；') || '未填',
    '其他想讓老師知道的事': f.additionalNotes || '未填',
  };
}

function toPlainText(f) {
  const fields = toReadableFields(f);
  return ['🎼 音樂學習需求評估', '────────────', ...Object.entries(fields).map(([k, v]) => `${k}：${v}`)].join('\n');
}

// 檢查每一步的必填題；回傳 { 欄位: 錯誤訊息 }
function validate(step, f) {
  const e = {};
  if (step === 1) {
    if (!f.name.trim()) e.name = '請填寫怎麼稱呼您';
    if (!f.contact.trim()) e.contact = '請填寫聯絡方式';
    if (!f.ageGroup) e.ageGroup = '請選擇年齡區間';
    if (f.instruments.length === 0) e.instruments = '請至少選一項（沒學過請選「完全沒有學過樂器」）';
  }
  if (step === 2) {
    if (!f.sheetReading) e.sheetReading = '請選擇最接近的狀況';
    if (f.skills.length === 0) e.skills = '請至少勾選一項（都還做不到也沒關係，請勾最後一項）';
  }
  if (step === 3) {
    if (f.primaryGoals.length === 0) e.primaryGoals = '請至少選一項';
  }
  if (step === 4) {
    if (f.painPoints.length === 0) e.painPoints = '請至少選一項（沒有特別困難請選最後一項）';
  }
  return e;
}

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [limitNotice, setLimitNotice] = useState(null); // { field, text }
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorText, setErrorText] = useState('');
  const [copied, setCopied] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // 防垃圾訊息用的隱藏欄位，真人不會填

  const goTo = (n) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // 複選題：處理「互斥選項」和「最多選幾項」
  const toggle = (field, value) => {
    const current = form[field];
    const exclusive = EXCLUSIVE_OPTION[field];
    let next;
    if (current.includes(value)) {
      next = current.filter((v) => v !== value);
    } else if (value === exclusive) {
      next = [value];
    } else {
      next = [...current.filter((v) => v !== exclusive), value];
    }
    const max = MAX_SELECT[field];
    if (max && next.length > max) {
      setLimitNotice({ field, text: `最多選 ${max} 項，請先取消一項再選` });
      return;
    }
    setLimitNotice(null);
    setField(field, next);
  };

  const next = () => {
    const e = validate(step, form);
    setErrors(e);
    if (Object.keys(e).length === 0) goTo(step + 1);
  };

  const submit = async () => {
    if (status === 'sending') return; // 避免連按送出兩次
    setStatus('sending');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `新的音樂學習需求評估：${form.name}`,
          _gotcha: honeypot,
          ...toReadableFields(form),
        }),
      });
      if (res.ok) {
        setStatus('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const data = await res.json().catch(() => null);
        setErrorText(data?.errors?.map((x) => x.message).join('；') || `伺服器回應錯誤（${res.status}）`);
        setStatus('error');
      }
    } catch {
      setErrorText('網路連線失敗，請確認網路後再試一次');
      setStatus('error');
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(form));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const hasInstrument = form.instruments.length > 0 && !form.instruments.includes(EXCLUSIVE_OPTION.instruments);
  const fieldProps = { form, errors, toggle, setField, limitNotice };

  return (
    <div className="min-h-screen pb-16">
      <Header />

      <main className="mx-auto max-w-2xl px-4">
        {step > 0 && status !== 'success' && <StaffProgress step={step} onJump={(n) => n < step && goTo(n)} />}

        <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_0_rgba(30,37,51,0.04),0_12px_32px_-16px_rgba(30,37,51,0.18)] sm:p-10">
          {status === 'success' ? (
            <SuccessScreen name={form.name} onCopy={copySummary} copied={copied} />
          ) : (
            <>
              {step === 0 && <Welcome onStart={() => goTo(1)} />}

              {step === 1 && (
                <Section title="基本資料" hint="方便老師聯絡您，並了解您的音樂經驗">
                  <TextField label="1. 怎麼稱呼您？" required placeholder="例如：小明、Alex" field="name" {...fieldProps} />
                  <TextField label="2. 方便聯絡的方式" required placeholder="例如：LINE ID 或 Email" field="contact" {...fieldProps} />
                  <Choice label="3. 年齡區間" required field="ageGroup" options={AGE_OPTIONS} columns={3} {...fieldProps} />
                  <Choice label="4. 學過或正在學哪些樂器？" required multi field="instruments" options={INSTRUMENT_OPTIONS} columns={2} {...fieldProps} />
                  {form.instruments.includes('其他樂器') && (
                    <TextField label="其他樂器是？" placeholder="請填寫樂器名稱" field="instrumentOther" sub {...fieldProps} />
                  )}
                  {hasInstrument && (
                    <div className="space-y-5 rounded-xl border border-line bg-paper p-4">
                      <TextField label="大約學了多久？" placeholder="例如：鋼琴小時候學過 3 年" field="experienceYears" sub {...fieldProps} />
                      <Choice label="目前的學習狀態" field="learningStatus" options={LEARNING_STATUS_OPTIONS} columns={3} sub {...fieldProps} />
                    </div>
                  )}
                </Section>
              )}

              {step === 2 && (
                <Section title="目前的音樂基礎" hint="沒有標準答案，照實際狀況選就好">
                  <Choice label="5. 您看五線譜的狀況最接近哪一種？" required field="sheetReading" options={SHEET_READING_OPTIONS} {...fieldProps} />
                  <Choice
                    label="6. 以下哪些是您「現在」大致做得到的？"
                    hint="大致做得到就可以勾，不需要很熟練"
                    required multi field="skills" options={SKILL_OPTIONS} {...fieldProps}
                  />
                </Section>
              )}

              {step === 3 && (
                <Section title="學習目標" hint="讓老師知道您最想學會什麼">
                  <Choice label="7. 這次學習最主要的目標是？" required multi field="primaryGoals" options={GOAL_OPTIONS} columns={2} {...fieldProps} />
                  {form.primaryGoals.includes('其他原因') && (
                    <TextField label="其他原因是？" placeholder="請簡單說明" field="primaryGoalOther" sub {...fieldProps} />
                  )}
                  <Choice label="8. 有沒有明確的時間壓力？" field="deadline" options={DEADLINE_OPTIONS} columns={2} {...fieldProps} />
                  {form.deadline.startsWith('有明確期限') && (
                    <div className="rounded-xl border border-line bg-paper p-4">
                      <label className="mb-1.5 block text-sm font-medium">預計的日期</label>
                      <input
                        type="date"
                        value={form.targetDate}
                        onChange={(e) => setField('targetDate', e.target.value)}
                        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                    </div>
                  )}
                  <Choice label="9. 對哪些主題有興趣？" multi field="topics" options={TOPIC_OPTIONS} columns={2} {...fieldProps} />
                </Section>
              )}

              {step === 4 && (
                <Section title="困難與期待" hint="越具體，老師越能幫上忙">
                  <Choice label="10. 目前最接近您狀況的困難是？" required multi field="painPoints" options={PAIN_POINT_OPTIONS} {...fieldProps} />
                  <TextArea
                    label="11. 最近一次覺得「卡住」是什麼情況？"
                    placeholder="例如：看到 Fmaj7 不知道怎麼彈、老師說這裡轉調但我聽不出來"
                    field="specificRoadblock" {...fieldProps}
                  />
                  <TextField label="12. 有沒有想在課堂上一起分析的曲子？" placeholder="曲名、歌手或 YouTube 連結" field="desiredSong" {...fieldProps} />
                  <Choice label="13. 比較喜歡哪種學習方式？" multi field="learningStyles" options={STYLE_OPTIONS} columns={2} {...fieldProps} />
                  <TextArea
                    label="14. 還有什麼想讓老師事先知道的嗎？"
                    placeholder="例如：每週可練習的時間、喜歡的音樂類型、正在準備的考試"
                    field="additionalNotes" {...fieldProps}
                  />
                </Section>
              )}

              {step === 5 && (
                <Section title="確認送出" hint="請檢查一下內容，需要修改可以點「修改」">
                  <Review fields={toReadableFields(form)} onEdit={goTo} />
                  {status === 'error' && (
                    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
                      <p className="flex items-start gap-2 font-medium text-accent">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        送出失敗：{errorText}
                      </p>
                      <p className="text-muted">可以再按一次送出。如果一直失敗，請複製內容，直接用 LINE 傳給老師。</p>
                      <button type="button" onClick={copySummary} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium hover:bg-paper">
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? '已複製！' : '複製問卷內容'}
                      </button>
                    </div>
                  )}
                  {/* 防垃圾訊息：畫面上看不到，只有機器人會填 */}
                  <input type="text" name="_gotcha" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                </Section>
              )}

              {step > 0 && (
                <nav className="mt-10 flex items-center justify-between border-t border-line pt-6">
                  <button type="button" onClick={() => goTo(step - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:text-ink">
                    <ChevronLeft className="h-4 w-4" /> 上一步
                  </button>
                  {step < LAST_STEP ? (
                    <button type="button" onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-ink/90">
                      下一步 <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={status === 'sending'}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                    >
                      {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {status === 'sending' ? '送出中…' : '確認送出'}
                    </button>
                  )}
                </nav>
              )}
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          您的資料只會用於安排課程，不會提供給其他人
        </p>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────
// 以下是畫面上重複使用的小元件
// ──────────────────────────────────────────────

function Header() {
  return (
    <header className="mx-auto max-w-2xl px-4 pb-6 pt-10 text-center">
      <svg viewBox="0 0 120 28" className="mx-auto mb-3 h-6 w-28 text-accent" aria-hidden="true">
        {[4, 9, 14, 19, 24].map((y) => (
          <line key={y} x1="0" x2="120" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
        ))}
        <ellipse cx="48" cy="19" rx="4" ry="3" transform="rotate(-20 48 19)" fill="currentColor" />
        <line x1="51.6" y1="18" x2="51.6" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <ellipse cx="70" cy="14" rx="4" ry="3" transform="rotate(-20 70 14)" fill="currentColor" />
        <line x1="73.6" y1="13" x2="73.6" y2="-2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <h1 className="font-serif text-2xl font-bold tracking-wide sm:text-3xl">音樂學習需求評估</h1>
      <p className="mt-2 text-sm text-muted">課前問卷 · 約 3～5 分鐘</p>
    </header>
  );
}

// 進度條：五線譜上的音符，走過的步驟會塗滿
function StaffProgress({ step, onJump }) {
  const width = 320;
  const xs = STEP_LABELS.map((_, i) => 40 + i * 60);
  const ys = [34, 29, 24, 19, 14];
  return (
    <div className="mb-5">
      <svg viewBox={`0 0 ${width} 48`} className="mx-auto w-full max-w-sm" aria-hidden="true">
        {[14, 19, 24, 29, 34].map((y) => (
          <line key={y} x1="10" x2={width - 10} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
        ))}
        {xs.map((x, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const color = current ? 'var(--color-accent)' : done ? 'var(--color-ink)' : 'var(--color-line)';
          return (
            <g key={i} onClick={() => onJump(n)} style={{ cursor: done ? 'pointer' : 'default' }}>
              <ellipse
                cx={x} cy={ys[i]} rx="5.5" ry="4" transform={`rotate(-20 ${x} ${ys[i]})`}
                fill={done || current ? color : 'var(--color-card)'} stroke={color} strokeWidth="1.5"
              />
              <line x1={x + 5} y1={ys[i] - 1} x2={x + 5} y2={ys[i] - 20} stroke={color} strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
      <div className="mx-auto grid max-w-sm grid-cols-5 text-center text-[11px]">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className={i + 1 === step ? 'font-bold text-accent' : i + 1 < step ? 'text-ink' : 'text-muted/60'}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Welcome({ onStart }) {
  return (
    <div className="space-y-6 text-center">
      <h2 className="font-serif text-xl font-bold sm:text-2xl">歡迎開始這段音樂學習旅程</h2>
      <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted">
        為了讓課程更符合您的需求，想先了解您的音樂背景與期待。填完之後，老師會在第一堂課前先看過您的回答。
      </p>
      <div className="mx-auto max-w-md rounded-xl bg-paper p-4 text-left text-sm leading-relaxed">
        <p className="font-medium">放輕鬆，這不是考試</p>
        <p className="mt-1 text-muted">即使沒有音樂基礎，或不確定自己的程度，都可以放心填寫。遇到不確定的題目，選「不確定」就可以了。</p>
      </div>
      <button type="button" onClick={onStart} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-8 py-3 text-[15px] font-medium text-white hover:bg-ink/90">
        開始填寫 <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-8">
      <div className="border-b border-line pb-4">
        <h2 className="font-serif text-xl font-bold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ text, required, multi, max, hint, sub }) {
  return (
    <div className="mb-3">
      <p className={sub ? 'text-sm font-medium' : 'text-[15px] font-semibold'}>
        {text}
        {required ? <span className="ml-1 text-accent">*</span> : !sub && <span className="ml-1.5 text-xs font-normal text-muted">（選填）</span>}
        {multi && <span className="ml-1.5 text-xs font-normal text-muted">{max ? `可複選，最多 ${max} 項` : '可複選'}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ErrorText({ text }) {
  return text ? <p className="mt-2 text-xs font-medium text-accent">{text}</p> : null;
}

function Choice({ label, hint, required, multi, sub, field, options, columns = 1, form, errors, toggle, setField, limitNotice }) {
  const value = form[field];
  const isSelected = (opt) => (multi ? value.includes(opt) : value === opt);
  const onPick = (opt) => (multi ? toggle(field, opt) : setField(field, value === opt && !required ? '' : opt));
  const grid = columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1';
  return (
    <div>
      <Label text={label} required={required} multi={multi} max={MAX_SELECT[field]} hint={hint} sub={sub} />
      <div className={`grid gap-2 ${grid}`}>
        {options.map((opt) => {
          const on = isSelected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              aria-pressed={on}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-snug transition-colors ${
                on ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${multi ? 'rounded' : 'rounded-full'} ${
                  on ? 'border-white bg-white text-ink' : 'border-ink/30'
                }`}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {limitNotice?.field === field && <p className="mt-2 text-xs font-medium text-accent">{limitNotice.text}</p>}
      <ErrorText text={errors[field]} />
    </div>
  );
}

function TextField({ label, required, placeholder, field, sub, form, errors, setField }) {
  return (
    <div>
      <Label text={label} required={required} sub={sub} />
      <input
        type="text"
        value={form[field]}
        placeholder={placeholder}
        onChange={(e) => setField(field, e.target.value)}
        className={`w-full rounded-xl border bg-card px-4 py-3 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/15 ${
          errors[field] ? 'border-accent' : 'border-line focus:border-accent'
        }`}
      />
      <ErrorText text={errors[field]} />
    </div>
  );
}

function TextArea({ label, placeholder, field, form, setField }) {
  return (
    <div>
      <Label text={label} />
      <textarea
        rows={3}
        value={form[field]}
        placeholder={placeholder}
        onChange={(e) => setField(field, e.target.value)}
        className="w-full resize-none rounded-xl border border-line bg-card px-4 py-3 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
    </div>
  );
}

// 確認頁：每個欄位屬於哪一步，方便點「修改」跳回去
const FIELD_STEP = {
  '稱呼': 1, '聯絡方式': 1, '年齡區間': 1, '樂器經驗': 1, '學習年資': 1, '目前學習狀態': 1,
  '五線譜閱讀': 2, '目前做得到的事': 2,
  '主要學習目標': 3, '時間壓力': 3, '有興趣的主題': 3,
  '目前的困難': 4, '具體卡關情境': 4, '想分析的曲子': 4, '偏好學習方式': 4, '其他想讓老師知道的事': 4,
};

function Review({ fields, onEdit }) {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
            <span className="text-sm font-semibold">{STEP_LABELS[s - 1]}</span>
            <button type="button" onClick={() => onEdit(s)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <Pencil className="h-3 w-3" /> 修改
            </button>
          </div>
          <dl className="divide-y divide-line">
            {Object.entries(fields)
              .filter(([k, v]) => FIELD_STEP[k] === s && v !== '—')
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                  <dt className="text-muted">{k}</dt>
                  <dd className={`space-y-1 ${v === '未填' ? 'text-muted/60' : ''}`}>
                    {v.split('；').map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function SuccessScreen({ name, onCopy, copied }) {
  return (
    <div className="space-y-6 py-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Check className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-bold">已經送出了，謝謝{name ? ` ${name}` : '您'}！</h2>
        <p className="text-[15px] text-muted">老師已經收到您的問卷，會在上課前先看過，我們課堂上見。</p>
      </div>
      <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-paper">
        <Copy className="h-4 w-4" />
        {copied ? '已複製！' : '複製一份自己留存'}
      </button>
    </div>
  );
}
