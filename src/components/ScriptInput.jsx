import React, { useRef } from 'react'
import { FileText, SeparatorHorizontal } from 'lucide-react'

const EXAMPLE_SCRIPT = `最初のスライドはタイトルスライドになります。
ここにメインタイトルやサブタイトルを書きます。
1. 項目その1
2. 項目その2
3. 項目その3

---

2枚目以降はコンテンツスライドです。
このテキストが白いボックスに表示されます。

---

スライドごとに「---」で区切ってください。
原稿の文言がそのままスライドに反映されます。`

export default function ScriptInput({ script, onScriptChange }) {
  const textareaRef = useRef(null)

  const slideCount = script.trim()
    ? script.split(/\n\s*---\s*\n/).filter(s => s.trim()).length
    : 0

  const insertSeparator = () => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sep = '\n\n---\n\n'
    const newScript = script.slice(0, start) + sep + script.slice(end)
    onScriptChange(newScript)

    requestAnimationFrame(() => {
      const pos = start + sep.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-sm font-medium text-violet-300">
          <FileText size={16} />
          原稿入力
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={insertSeparator}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition"
            title="カーソル位置にスライド区切り（---）を挿入"
          >
            <SeparatorHorizontal size={13} />
            区切り挿入
          </button>
          {slideCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
              {slideCount} 枚のスライド
            </span>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
        placeholder={EXAMPLE_SCRIPT}
        className="flex-1 w-full p-4 rounded-xl glass-dark text-sm text-white/90 leading-relaxed placeholder-white/20 min-h-[200px] font-mono"
        spellCheck={false}
      />
    </div>
  )
}
