import React, { useState, useRef, useCallback } from 'react'
import { Play, Square, Sparkles } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ScriptInput from './components/ScriptInput'
import OutputFeed from './components/OutputFeed'
import { runPipeline } from './lib/engine'
import { compositeTitle, compositeContent, recomposite } from './lib/compositor'
import { getAllCharacterImages } from './lib/storage'

export default function App() {
  const [config, setConfig] = useState({
    googleApiKey: '',
    openaiApiKey: '',
    provider: 'google',
    llmModel: 'gemini-2.5-flash',
    model: 'gemini-3-pro-image-preview',
    fontFamily: 'Noto Sans JP',
    fontWeight: '700',
    selectedCharacterIds: [],
    characterRoles: {},
    globalInstruction: '',
  })

  const [script, setScript] = useState(() => localStorage.getItem('slide-gen-script') || '')
  const [results, setResults] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const abortControllerRef = useRef(null)

  const handleScriptChange = useCallback((value) => {
    setScript(value)
    localStorage.setItem('slide-gen-script', value)
  }, [])

  const handleConfigChange = useCallback((patch) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const activeApiKey = config.provider === 'google' ? config.googleApiKey : config.openaiApiKey

  const handleGenerate = async () => {
    if (!activeApiKey) {
      setStatusMessage(`${config.provider === 'google' ? 'Google' : 'OpenAI'} APIキーを入力してください`)
      setTimeout(() => setStatusMessage(''), 3000)
      return
    }
    if (!script.trim()) {
      setStatusMessage('原稿を入力してください')
      setTimeout(() => setStatusMessage(''), 3000)
      return
    }

    let characterDescription = ''
    let characterImageDataUrls = []
    const chars = await getAllCharacterImages()
    const selectedIds = config.selectedCharacterIds || []
    if (chars.length > 0 && selectedIds.length > 0) {
      const selectedChars = selectedIds
        .map(id => chars.find(c => c.id === id))
        .filter(Boolean)
      if (selectedChars.length > 0) {
        characterImageDataUrls = selectedChars.map(c => c.dataUrl)
        const charNames = selectedChars.map(c => c.name).join('、')
        const roles = config.characterRoles || {}
        const roleDescriptions = selectedChars
          .map((c, i) => {
            const role = roles[c.id]?.trim()
            return role
              ? `- キャラクター${i + 1}（${c.name}）: ${role}`
              : `- キャラクター${i + 1}（${c.name}）`
          })
          .join('\n')

        const baseDesc = selectedChars.length === 1
          ? `添付のキャラクター画像を参照し、このキャラクターの外見的特徴を正確に読み取ってください。生成する各背景画像では、キャラクターの外見を維持したまま、スライドの文脈に合った自然な表情・ポーズで登場させてください。`
          : `添付の${selectedChars.length}枚のキャラクター画像をそれぞれ参照し、各キャラクターの外見的特徴を正確に読み取ってください。生成する各背景画像では、全キャラクターを登場させ、それぞれの外見を維持したまま描いてください。`

        const hasRoles = selectedChars.some(c => roles[c.id]?.trim())
        characterDescription = hasRoles
          ? `${baseDesc}\n\n【キャラクター役割】\n${roleDescriptions}\n\n各キャラクターを指定された役割に合ったポーズ・表情・配置で描いてください。`
          : baseDesc
      }
    }

    // 全体指示を追加
    const globalInstruction = (config.globalInstruction || '').trim()
    if (globalInstruction) {
      characterDescription = characterDescription
        ? `${characterDescription}\n\n【全体指示】\n${globalInstruction}`
        : `【全体指示】\n${globalInstruction}`
    }

    setIsGenerating(true)
    setResults([])
    setStatusMessage('生成を開始しています...')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await runPipeline({
        apiKey: activeApiKey,
        script,
        aspectRatio: '16:9',
        model: config.model,
        llmModel: config.llmModel,
        provider: config.provider,
        characterDescription,
        characterImageDataUrls,
        abortController: controller,
        onProgress: async (event) => {
          switch (event.type) {
            case 'start':
              setStatusMessage(`全 ${event.total} スライドの生成を開始...`)
              break
            case 'slide-start':
              setStatusMessage(event.message)
              break
            case 'yaml-complete':
              break
            case 'slide-complete': {
              const r = event.result
              setStatusMessage(`スライド ${event.index + 1}/${event.total}: テキスト合成中...`)

              try {
                const compositeOpts = {
                  fontFamily: config.fontFamily,
                  fontWeight: config.fontWeight,
                }
                // compositeTitle / compositeContent は [{ url, pageText }] を返す
                const pages = r.isTitle
                  ? await compositeTitle(r.bgImageUrl, r.slideText, compositeOpts)
                  : await compositeContent(r.bgImageUrl, r.slideText, compositeOpts)

                // ページ分割結果をresultsに追加
                const newItems = pages.map((page, pi) => ({
                  ...r,
                  compositeUrl: page.url,
                  pageText: page.pageText,
                  pageIndex: pi,
                  totalPages: pages.length,
                }))

                setResults((prev) => [...prev, ...newItems])
              } catch (compErr) {
                console.error('[compositor] error:', compErr)
                setResults((prev) => [...prev, r])
              }

              setStatusMessage(`スライド ${event.index + 1}/${event.total} 完了`)
              break
            }
            case 'error':
              setResults((prev) => [...prev, { index: event.index, error: event.message }])
              break
            case 'stopped':
              setStatusMessage(`生成を停止しました（${event.completedCount} 枚生成済み）`)
              break
            case 'done':
              setStatusMessage('スライド生成が完了しました')
              break
          }
        },
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatusMessage(`エラー: ${err.message}`)
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setStatusMessage('停止中...')
    }
  }

  // テキスト編集 → 同じ背景で再合成
  const handleRecomposite = useCallback(async (resultIndex, newText) => {
    setResults((prev) => {
      const target = prev[resultIndex]
      if (!target || !target.bgImageUrl) return prev

      // 非同期で再合成して結果を更新
      const compositeOpts = {
        fontFamily: config.fontFamily,
        fontWeight: config.fontWeight,
      }

      recomposite(target.bgImageUrl, newText, target.isTitle, compositeOpts)
        .then((newUrl) => {
          setResults((curr) => {
            const updated = [...curr]
            updated[resultIndex] = {
              ...updated[resultIndex],
              compositeUrl: newUrl,
              pageText: newText,
            }
            return updated
          })
        })
        .catch((err) => {
          console.error('[recomposite] error:', err)
        })

      return prev
    })
  }, [config.fontFamily, config.fontWeight])

  return (
    <div className="h-screen flex">
      <Sidebar config={config} onConfigChange={handleConfigChange} />

      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        <header>
          <div className="flex items-center gap-3">
            <Sparkles size={24} className="text-violet-400" />
            <h1 className="text-xl font-bold tracking-tight">
              スライド生成システム
            </h1>
          </div>
          <p className="text-xs text-white/50 mt-1 ml-9">
            原稿から背景画像を生成し、テキストを合成してスライドを作成します。
          </p>
        </header>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="glass p-4 flex-shrink-0" style={{ maxHeight: '35vh' }}>
            <ScriptInput script={script} onScriptChange={handleScriptChange} />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition btn-glow ${
                isGenerating
                  ? 'bg-violet-500/30 text-white/40 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
              }`}
            >
              <Play size={16} />
              生成開始
            </button>

            {isGenerating && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm bg-red-600 hover:bg-red-500 text-white transition btn-stop"
              >
                <Square size={16} />
                停止
              </button>
            )}

            {statusMessage && !isGenerating && (
              <span className="text-sm text-white/50">{statusMessage}</span>
            )}
          </div>

          <div className="glass p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <OutputFeed
              results={results}
              statusMessage={isGenerating ? statusMessage : ''}
              onRecomposite={handleRecomposite}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
