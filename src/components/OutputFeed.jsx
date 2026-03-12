import React, { useRef, useEffect, useState } from 'react'
import { Layers, Code, AlertCircle, Download, DownloadCloud, Pencil, Check, X } from 'lucide-react'
import JSZip from 'jszip'

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

async function downloadAllAsZip(results) {
  const slides = results.filter(r => r.compositeUrl && !r.error)
  const zip = new JSZip()

  for (let i = 0; i < slides.length; i++) {
    const res = await fetch(slides[i].compositeUrl)
    const blob = await res.blob()
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const blobUrl = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = 'slides.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

function ZipDownloadButton({ results }) {
  const [zipping, setZipping] = useState(false)

  const handleClick = async () => {
    setZipping(true)
    try {
      await downloadAllAsZip(results)
    } finally {
      setZipping(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={zipping}
      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
    >
      <DownloadCloud size={14} />
      {zipping ? 'ZIP作成中...' : 'ZIPでダウンロード'}
    </button>
  )
}

function EditableSlide({ item, displayIndex, onRecomposite }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setEditText(item.pageText || item.slideText || '')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await onRecomposite(item._resultIndex, editText)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-dark p-4 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
          スライド {displayIndex}
          {item.isTitle && ' (タイトル)'}
          {item.totalPages > 1 && ` [${item.pageIndex + 1}/${item.totalPages}]`}
        </span>
        {item.error && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1">
            <AlertCircle size={10} /> エラー
          </span>
        )}
      </div>

      {item.error ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-300">{item.error}</p>
        </div>
      ) : (
        <>
          {/* 合成済みスライド画像 */}
          {item.compositeUrl && (
            <div className="mb-3 relative group">
              <img
                src={item.compositeUrl}
                alt={`スライド ${displayIndex}`}
                className="w-full rounded-lg"
                loading="lazy"
              />
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80"
                  title="テキストを編集"
                >
                  <Pencil size={13} /> 編集
                </button>
                <button
                  onClick={() => downloadImage(item.compositeUrl, `slide-${displayIndex}.png`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80"
                  title="ダウンロード"
                >
                  <Download size={13} /> 保存
                </button>
              </div>
            </div>
          )}

          {/* テキスト編集UI */}
          {editing && (
            <div className="mb-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs text-violet-300 mb-2">テキストを編集（改行位置を調整できます）</p>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-3 rounded-lg glass-dark text-sm text-white/90 leading-relaxed font-mono min-h-[120px]"
                spellCheck={false}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  <Check size={13} /> {saving ? '合成中...' : '再合成'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium glass-dark text-white/60 hover:text-white/90 transition"
                >
                  <X size={13} /> キャンセル
                </button>
              </div>
            </div>
          )}

          {/* 詳細 */}
          {(item.slideText || item.yamlPrompt) && (
            <details className="group">
              <summary className="flex items-center gap-2 text-xs text-white/40 cursor-pointer hover:text-white/60 transition">
                <Code size={12} /> 原稿テキスト・YAMLプロンプト
              </summary>
              <div className="mt-2 space-y-2">
                {item.pageText && (
                  <pre className="p-3 rounded-lg bg-black/30 text-xs text-white/60 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                    {item.pageText}
                  </pre>
                )}
                {item.yamlPrompt && (
                  <pre className="p-3 rounded-lg bg-black/30 text-xs text-white/60 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                    {item.yamlPrompt}
                  </pre>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

export default function OutputFeed({ results, statusMessage, onRecomposite }) {
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [results, statusMessage])

  const successResults = results.filter(r => r.compositeUrl && !r.error)

  if (results.length === 0 && !statusMessage) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20">
        <div className="text-center">
          <Layers size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">生成されたスライドがここに表示されます</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 一括ダウンロード */}
      {successResults.length > 0 && !statusMessage && (
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <span className="text-xs text-white/40">{successResults.length} 枚のスライドを生成済み</span>
          <ZipDownloadButton results={results} />
        </div>
      )}

      <div ref={feedRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {results.map((item, i) => (
          <EditableSlide
            key={`${item.index}-${item.pageIndex || 0}-${i}`}
            item={{ ...item, _resultIndex: i }}
            displayIndex={i + 1}
            onRecomposite={onRecomposite}
          />
        ))}

        {statusMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 animate-fade-in-up">
            <div className="w-2 h-2 rounded-full bg-violet-400 pulse-dot" />
            <span className="text-sm text-violet-300">{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
