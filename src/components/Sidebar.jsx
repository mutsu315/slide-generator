import React, { useState, useEffect, useRef } from 'react'
import { Settings, Key, Image, Trash2, Upload, Type } from 'lucide-react'
import { saveCharacterImage, getAllCharacterImages, deleteCharacterImage } from '../lib/storage'

const GOOGLE_LLM_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
]

const GOOGLE_IMAGE_MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro（Gemini 3 Pro）' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2（Gemini 3.1 Flash）' },
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana（Gemini 2.5 Flash）' },
  { id: 'imagen-3.0-generate-002', name: 'Imagen 3' },
  { id: 'imagen-3.0-fast-generate-001', name: 'Imagen 3 Fast' },
]

const OPENAI_LLM_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
]

const OPENAI_IMAGE_MODELS = [
  { id: 'dall-e-3', name: 'DALL-E 3' },
  { id: 'dall-e-2', name: 'DALL-E 2' },
]

const FONT_OPTIONS = [
  { id: 'Noto Sans JP', name: 'Noto Sans JP（ゴシック）' },
  { id: 'Noto Serif JP', name: 'Noto Serif JP（明朝）' },
  { id: 'M PLUS 1p', name: 'M PLUS 1p' },
  { id: 'M PLUS Rounded 1c', name: 'M PLUS Rounded 1c（丸ゴシック）' },
  { id: 'Zen Kaku Gothic New', name: 'Zen Kaku Gothic New' },
  { id: 'BIZ UDPGothic', name: 'BIZ UDPGothic' },
  { id: 'BIZ UDPMincho', name: 'BIZ UDPMincho（明朝）' },
]

const FONT_WEIGHTS = [
  { id: '400', name: 'Regular' },
  { id: '500', name: 'Medium' },
  { id: '700', name: 'Bold' },
  { id: '900', name: 'Black' },
]

export default function Sidebar({ config, onConfigChange }) {
  const [characters, setCharacters] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const fileInputRef = useRef(null)

  // localStorage から復元
  useEffect(() => {
    const saved = {
      googleApiKey: localStorage.getItem('slide-gen-google-api-key') || '',
      openaiApiKey: localStorage.getItem('slide-gen-openai-api-key') || '',
      provider: localStorage.getItem('slide-gen-provider') || 'google',
      llmModel: localStorage.getItem('slide-gen-llm-model') || 'gemini-2.5-flash',
      model: localStorage.getItem('slide-gen-image-model') || 'gemini-3-pro-image-preview',
      fontFamily: localStorage.getItem('slide-gen-font-family') || 'Noto Sans JP',
      fontWeight: localStorage.getItem('slide-gen-font-weight') || '700',
      characterRoles: JSON.parse(localStorage.getItem('slide-gen-char-roles') || '{}'),
      selectedCharacterIds: JSON.parse(localStorage.getItem('slide-gen-selected-chars') || '[]'),
    }
    onConfigChange(saved)
  }, [])

  // キャラクター画像読み込み
  useEffect(() => {
    getAllCharacterImages().then(setCharacters)
  }, [])

  // 選択中キャラがなければ最初のキャラを自動選択
  useEffect(() => {
    if (characters.length > 0 && (!config.selectedCharacterIds || config.selectedCharacterIds.length === 0)) {
      updateCharacterIds([characters[0].id])
    }
  }, [characters])

  const update = (key, value) => {
    onConfigChange({ [key]: value })
    const storageMap = {
      googleApiKey: 'slide-gen-google-api-key',
      openaiApiKey: 'slide-gen-openai-api-key',
      provider: 'slide-gen-provider',
      llmModel: 'slide-gen-llm-model',
      model: 'slide-gen-image-model',
      fontFamily: 'slide-gen-font-family',
      fontWeight: 'slide-gen-font-weight',
    }
    if (storageMap[key] && value != null) {
      localStorage.setItem(storageMap[key], value)
    }
  }

  const updateCharacterIds = (ids) => {
    onConfigChange({ selectedCharacterIds: ids })
    localStorage.setItem('slide-gen-selected-chars', JSON.stringify(ids))
  }

  const updateCharacterRole = (id, role) => {
    const roles = { ...(config.characterRoles || {}), [id]: role }
    onConfigChange({ characterRoles: roles })
    localStorage.setItem('slide-gen-char-roles', JSON.stringify(roles))
  }

  const handleProviderChange = (provider) => {
    update('provider', provider)
    if (provider === 'google') {
      update('llmModel', 'gemini-2.5-flash')
      update('model', 'gemini-3-pro-image-preview')
    } else {
      update('llmModel', 'gpt-4o')
      update('model', 'dall-e-3')
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const id = `char_${Date.now()}`
      const dataUrl = ev.target.result
      await saveCharacterImage(id, file.name, dataUrl)
      const updated = await getAllCharacterImages()
      setCharacters(updated)
      updateCharacterIds([...(config.selectedCharacterIds || []), id])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDeleteCharacter = async (id) => {
    await deleteCharacterImage(id)
    const updated = await getAllCharacterImages()
    setCharacters(updated)
    const newIds = (config.selectedCharacterIds || []).filter(cid => cid !== id)
    updateCharacterIds(newIds.length > 0 ? newIds : (updated.length > 0 ? [updated[0].id] : []))
  }

  const handleToggleCharacter = (id) => {
    const current = config.selectedCharacterIds || []
    if (current.includes(id)) {
      // 最低1つは残す
      if (current.length > 1) {
        updateCharacterIds(current.filter(cid => cid !== id))
      }
    } else {
      updateCharacterIds([...current, id])
    }
  }

  const isGoogle = config.provider === 'google'
  const llmModels = isGoogle ? GOOGLE_LLM_MODELS : OPENAI_LLM_MODELS
  const imageModels = isGoogle ? GOOGLE_IMAGE_MODELS : OPENAI_IMAGE_MODELS

  if (collapsed) {
    return (
      <div
        className="w-10 h-screen flex items-start pt-4 justify-center cursor-pointer glass"
        style={{ borderRadius: '0 16px 16px 0' }}
        onClick={() => setCollapsed(false)}
      >
        <Settings size={18} className="text-white/60" />
      </div>
    )
  }

  return (
    <aside className="w-80 h-screen overflow-y-auto glass p-5 flex flex-col gap-4" style={{ borderRadius: '0 16px 16px 0' }}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Settings size={16} /> 設定
        </h2>
        <button onClick={() => setCollapsed(true)} className="text-white/40 hover:text-white/70 text-xs">&lt;</button>
      </div>

      {/* Google APIキー */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">
          <Key size={12} /> Google APIキー
          {isGoogle && <span className="text-emerald-400 text-[10px] ml-1">使用中</span>}
        </label>
        <input
          type="password"
          value={config.googleApiKey}
          onChange={(e) => update('googleApiKey', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 placeholder-white/30"
          placeholder="AIza..."
        />
      </div>

      {/* OpenAI APIキー */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">
          <Key size={12} /> OpenAI APIキー
          {!isGoogle && <span className="text-emerald-400 text-[10px] ml-1">使用中</span>}
        </label>
        <input
          type="password"
          value={config.openaiApiKey}
          onChange={(e) => update('openaiApiKey', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 placeholder-white/30"
          placeholder="sk-..."
        />
      </div>
      <p className="text-[10px] text-white/30">両方のキーをブラウザに安全に保存できます</p>

      {/* プロバイダー */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">AIプロバイダー</label>
        <div className="flex gap-2">
          {['google', 'openai'].map(p => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                config.provider === p
                  ? 'bg-violet-600 text-white'
                  : 'glass-dark text-white/50 hover:text-white/80'
              }`}
            >
              {p === 'google' ? 'Google (Gemini + Imagen)' : 'OpenAI (GPT + DALL-E)'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-1">上で入力済みの対応キーが自動で使われます</p>
      </div>

      {/* LLMモデル */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">LLMモデル（プロンプト生成）</label>
        <select
          value={config.llmModel}
          onChange={(e) => update('llmModel', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 bg-transparent"
        >
          {llmModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 画像生成モデル */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">画像生成モデル</label>
        <select
          value={config.model}
          onChange={(e) => update('model', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 bg-transparent"
        >
          {imageModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="custom">カスタムモデルID</option>
        </select>
        {config.model === 'custom' && (
          <input
            type="text"
            value={config.customModel || ''}
            onChange={(e) => update('customModel', e.target.value)}
            className="w-full mt-2 px-3 py-2 rounded-lg glass-dark text-sm text-white/90 placeholder-white/30"
            placeholder="モデルIDを入力"
          />
        )}
      </div>

      {/* フォント設定 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">
          <Type size={12} /> スライドフォント
        </label>
        <select
          value={config.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 bg-transparent"
        >
          {FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">フォントウェイト</label>
        <select
          value={config.fontWeight}
          onChange={(e) => update('fontWeight', e.target.value)}
          className="w-full px-3 py-2 rounded-lg glass-dark text-sm text-white/90 bg-transparent"
        >
          {FONT_WEIGHTS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* フォントプレビュー */}
      <div className="glass-dark p-3 rounded-lg">
        <p className="text-[10px] text-white/40 mb-1">プレビュー</p>
        <p style={{ fontFamily: config.fontFamily, fontWeight: config.fontWeight, fontSize: '16px' }}>
          スライド生成システム 1234
        </p>
      </div>

      {/* キャラクター画像 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-violet-300 mb-1">
          <Image size={12} /> キャラクター画像
        </label>

        {characters.map(c => {
          const isSelected = (config.selectedCharacterIds || []).includes(c.id)
          const role = (config.characterRoles || {})[c.id] || ''
          return (
          <div key={c.id} className="mb-2">
            <div
              onClick={() => handleToggleCharacter(c.id)}
              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition"
              style={isSelected ? { outline: '2px solid #22c55e', outlineOffset: '2px' } : {}}
            >
              <img src={c.dataUrl} alt={c.name} className="w-10 h-10 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{c.name}</p>
                {isSelected ? (
                  <span className="text-[10px] text-emerald-400">選択中</span>
                ) : (
                  <span className="text-[10px] text-white/30">クリックで選択</span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(c.id) }}
                className="text-white/20 hover:text-red-400 transition p-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {isSelected && (
              <input
                type="text"
                value={role}
                onChange={(e) => updateCharacterRole(c.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="役割・指示（例: 先生役、生徒役、解説者）"
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg glass-dark text-[11px] text-white/90 placeholder-white/20"
                spellCheck={false}
              />
            )}
          </div>
          )
        })}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg glass-dark text-xs text-white/50 hover:text-white/80 transition mt-1"
        >
          <Upload size={13} /> 画像を追加
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <p className="text-[10px] text-white/20 mt-1">IndexedDBに永続保存 / 複数選択可 / 各キャラに役割指定可</p>
      </div>
    </aside>
  )
}
