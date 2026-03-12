import React, { useRef, useEffect } from 'react'
import { ImageIcon, Code, AlertCircle, Download, DownloadCloud, Layers } from 'lucide-react'

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

async function downloadAll(results) {
  const slides = results.filter(r => r.compositeUrl && !r.error)
  for (let i = 0; i < slides.length; i++) {
    await downloadImage(slides[i].compositeUrl, `slide-${slides[i].index + 1}.png`)
    if (i < slides.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

export default function OutputFeed({ results, statusMessage }) {
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
          <button
            onClick={() => downloadAll(results)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition"
          >
            <DownloadCloud size={14} />
            すべてダウンロード
          </button>
        </div>
      )}

      <div ref={feedRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {results.map((item, i) => (
          <div
            key={i}
            className="glass-dark p-4 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                スライド {item.index + 1}
                {item.isTitle && ' (タイトル)'}
              </span>
              {item.error && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1">
                  <AlertCircle size={10} />
                  エラー
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
                      alt={`スライド ${item.index + 1}`}
                      className="w-full rounded-lg"
                      loading="lazy"
                    />
                    <button
                      onClick={() => downloadImage(item.compositeUrl, `slide-${item.index + 1}.png`)}
                      className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                      title="ダウンロード"
                    >
                      <Download size={13} />
                      保存
                    </button>
                  </div>
                )}

                {/* 背景画像のみ（合成前） */}
                {item.bgImageUrl && !item.compositeUrl && (
                  <div className="mb-3">
                    <p className="text-xs text-white/40 mb-1">背景画像（テキスト合成待ち）</p>
                    <img
                      src={item.bgImageUrl}
                      alt={`背景 ${item.index + 1}`}
                      className="w-full rounded-lg opacity-60"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* スライドテキスト */}
                {item.slideText && (
                  <details className="group">
                    <summary className="flex items-center gap-2 text-xs text-white/40 cursor-pointer hover:text-white/60 transition">
                      <Code size={12} />
                      原稿テキスト・YAMLプロンプト
                    </summary>
                    <div className="mt-2 space-y-2">
                      <pre className="p-3 rounded-lg bg-black/30 text-xs text-white/60 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                        {item.slideText}
                      </pre>
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
        ))}

        {/* ステータス */}
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
