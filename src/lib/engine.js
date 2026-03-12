/**
 * スライド生成エンジン
 *
 * 原稿を「---」で分割し、各スライドに対して:
 * 1. LLMで背景画像用YAMLプロンプト生成
 * 2. 画像生成APIで背景画像を生成
 * 3. Canvas合成は呼び出し元（App）で行う
 *
 * 対応プロバイダー: Google (Gemini + Imagen) / OpenAI (GPT + DALL-E)
 */

// ── パーサー ──────────────────────────────────────────────

export function parseScript(text) {
  const slides = text.split(/\n\s*---\s*\n/).map(s => s.trim()).filter(Boolean)
  return slides.map((text, index) => ({
    index,
    text,
    isTitle: index === 0,
  }))
}

// ── YAMLプロンプト生成 ───────────────────────────────────

function buildYamlPromptRequest(slide, characterDescription, aspectRatio) {
  const slideType = slide.isTitle ? 'タイトルスライド' : 'コンテンツスライド'

  const characterBlock = characterDescription
    ? `
重要 - キャラクター指示:
- 添付されたキャラクター画像からキャラクターの外見的特徴を正確に読み取ってください。
- character_appearance にキャラクターの外見を詳細に記述してください。
- スクリプトの文脈に合ったポーズと表情を指定してください。同じポーズの使い回しは避けてください。
- キャラクターの画風もcharacter_appearanceに含めてください。`
    : ''

  const layoutInstruction = slide.isTitle
    ? `これはタイトルスライドの右側背景画像です。
- キャラクターを画面の中央〜右寄りに配置し、自信に満ちた表情でポーズを取らせてください。
- 背景は明るく清潔感のある色調（薄いベージュ、ライトグレー等）にしてください。
- キャラクターの上半身〜全身が映るポートレート構図にしてください。`
    : `これはコンテンツスライドの全面背景画像です。
- スライドのテキスト内容に合った場面を描いてください。
- キャラクターを自然にシーンに登場させ、内容に合った表情・ポーズにしてください。
- 明るくプロフェッショナルな雰囲気の画像にしてください。
- 画像の左側にテキストボックスが重なるため、重要な要素は右寄りに配置してください。`

  const systemPrompt = `あなたはスライド背景画像のプロンプト設計の専門家です。
与えられたスライドのテキスト内容から、背景画像を生成するためのプロンプトをYAML形式で出力してください。

【スライド種別】${slideType}

${layoutInstruction}

出力フォーマット（YAML）:
\`\`\`yaml
background_image_prompt:
  scene_description: "シーンの詳細な説明"
  visual_style: "ビジュアルスタイル（実写風、イラスト風等）"
  color_palette: ["#hex1", "#hex2", "#hex3"]
  character_appearance: "キャラクターの外見的特徴の詳細"
  character_pose_expression: "文脈に合ったポーズと表情の具体的な指示"
  character_placement: "画面内でのキャラクターの位置とサイズ"
  background_setting: "背景の場所・雰囲気の詳細"
  lighting: "照明・光の方向"
  mood: "全体の雰囲気"
  aspect_ratio: "${aspectRatio}"
\`\`\`

重要:
- これはスライドの背景画像なので、画像内にテキストや文字を一切入れないでください
- アスペクト比 ${aspectRatio} に最適化してください${characterBlock}`

  const userMessage = `以下のスライドテキストに基づいて、背景画像のYAMLプロンプトを生成してください。

【スライドテキスト】
${slide.text}

YAMLプロンプトのみを出力してください。`

  return { systemPrompt, userMessage }
}

function yamlToImagePrompt(yamlText) {
  const lines = yamlText.split('\n')
  const fields = {}
  let currentKey = null

  for (const line of lines) {
    const match = line.match(/^\s*(\w+):\s*"?(.+?)"?\s*$/)
    if (match) {
      currentKey = match[1]
      fields[currentKey] = match[2]
    } else if (line.match(/^\s*-\s*"?(.+?)"?\s*$/)) {
      if (!fields[currentKey + '_list']) fields[currentKey + '_list'] = []
      fields[currentKey + '_list'].push(line.match(/^\s*-\s*"?(.+?)"?\s*$/)[1])
    }
  }

  const parts = []
  if (fields.scene_description) parts.push(fields.scene_description)
  if (fields.visual_style) parts.push(`Style: ${fields.visual_style}`)
  if (fields.character_appearance) parts.push(`Character appearance: ${fields.character_appearance}`)
  if (fields.character_pose_expression) parts.push(`Pose and expression: ${fields.character_pose_expression}`)
  if (fields.character_placement) parts.push(`Character placement: ${fields.character_placement}`)
  if (fields.background_setting) parts.push(`Background: ${fields.background_setting}`)
  if (fields.lighting) parts.push(`Lighting: ${fields.lighting}`)
  if (fields.mood) parts.push(`Mood: ${fields.mood}`)

  // 背景画像なのでテキスト不要を明記
  parts.push('Do NOT include any text, labels, titles, or watermarks in the image.')

  return parts.join('. ') || yamlText
}

// ── ユーティリティ ───────────────────────────────────────

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { mimeType: 'image/png', base64: dataUrl }
  return { mimeType: match[1], base64: match[2] }
}

export function detectProvider(apiKey) {
  if (!apiKey) return 'openai'
  if (apiKey.startsWith('AIza')) return 'google'
  if (apiKey.startsWith('sk-')) return 'openai'
  return 'openai'
}

// ── OpenAI API ───────────────────────────────────────────

async function openaiGenerateYaml(apiKey, slide, characterDescription, aspectRatio, llmModel, signal) {
  const { systemPrompt, userMessage } = buildYamlPromptRequest(slide, characterDescription, aspectRatio)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: llmModel || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI LLM エラー: ${res.status} - ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

async function openaiGenerateImage(apiKey, prompt, aspectRatio, model, signal) {
  const sizeMap = {
    '16:9': '1792x1024',
    '1:1': '1024x1024',
    '4:3': '1792x1024',
    '9:16': '1024x1792',
  }
  const size = sizeMap[aspectRatio] || '1792x1024'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      quality: 'hd',
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI 画像生成エラー: ${res.status} - ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return {
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
  }
}

// ── Google Gemini + Imagen API ───────────────────────────

async function geminiGenerateYaml(apiKey, slide, characterDescription, aspectRatio, llmModel, characterImageDataUrl, signal) {
  const { systemPrompt, userMessage } = buildYamlPromptRequest(slide, characterDescription, aspectRatio)

  const geminiModel = llmModel || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

  const userParts = [{ text: userMessage }]
  if (characterImageDataUrl) {
    const { mimeType, base64 } = parseDataUrl(characterImageDataUrl)
    userParts.push({ inlineData: { mimeType, data: base64 } })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: userParts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini LLM エラー: ${res.status} - ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function isGeminiGenerateContentModel(model) {
  return model.startsWith('gemini-')
}

async function googleGenerateImage(apiKey, prompt, aspectRatio, model, characterImageDataUrl, signal) {
  const targetModel = model || 'imagen-3.0-generate-002'

  if (isGeminiGenerateContentModel(targetModel)) {
    return geminiGenerateContentImage(apiKey, prompt, aspectRatio, targetModel, characterImageDataUrl, signal)
  }

  return predictApiImage(apiKey, prompt, aspectRatio, targetModel, signal)
}

async function predictApiImage(apiKey, prompt, aspectRatio, model, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: prompt.slice(0, 4000) }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio || '16:9',
      },
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Google 画像生成エラー (${model}): ${res.status} - ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const prediction = data.predictions?.[0]
  if (prediction?.bytesBase64Encoded) {
    return { url: `data:image/png;base64,${prediction.bytesBase64Encoded}`, revisedPrompt: '' }
  }

  throw new Error(`${model} から画像データを取得できませんでした。`)
}

async function geminiGenerateContentImage(apiKey, prompt, aspectRatio, model, characterImageDataUrl, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts = [
    { text: `Generate a background image for a presentation slide based on the following description. Do NOT include any text or labels in the image. Aspect ratio: ${aspectRatio}.\n\n${prompt.slice(0, 3000)}` }
  ]

  if (characterImageDataUrl) {
    const { mimeType, base64 } = parseDataUrl(characterImageDataUrl)
    parts.unshift({ text: `Below is a character reference image. Study this character's visual design carefully — hairstyle, hair color, eye color, outfit, accessories, art style, and body proportions. Then generate the slide background image featuring this SAME character but in the pose and expression described in the prompt below. Do NOT simply copy the reference image — adapt the character naturally into the scene.` })
    parts.splice(1, 0, { inlineData: { mimeType, data: base64 } })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Google 画像生成エラー (${model}): ${res.status} - ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const responseParts = data.candidates?.[0]?.content?.parts || []

  for (const part of responseParts) {
    if (part.inlineData) {
      return { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, revisedPrompt: '' }
    }
  }

  throw new Error('Google APIから画像データを取得できませんでした。')
}

// ── メインパイプライン ─────────────────────────────────

export async function runPipeline({
  apiKey,
  script,
  aspectRatio = '16:9',
  model = '',
  llmModel = '',
  provider = '',
  characterDescription = '',
  characterImageDataUrl = null,
  abortController,
  onProgress,
}) {
  const signal = abortController.signal
  const slides = parseScript(script)
  const detectedProvider = provider || detectProvider(apiKey)

  if (slides.length === 0) {
    throw new Error('原稿にスライドが見つかりませんでした。「---」で区切ってください。')
  }

  onProgress?.({ type: 'start', total: slides.length, provider: detectedProvider })

  const results = []

  for (let i = 0; i < slides.length; i++) {
    if (signal.aborted) break

    const slide = slides[i]

    // ステップ1: YAMLプロンプト生成
    onProgress?.({
      type: 'slide-start',
      index: i,
      total: slides.length,
      step: 'yaml',
      message: `スライド ${i + 1}/${slides.length}: プロンプト生成中...`,
    })

    let yamlPrompt
    try {
      if (detectedProvider === 'google') {
        yamlPrompt = await geminiGenerateYaml(apiKey, slide, characterDescription, aspectRatio, llmModel, characterImageDataUrl, signal)
      } else {
        yamlPrompt = await openaiGenerateYaml(apiKey, slide, characterDescription, aspectRatio, llmModel, signal)
      }
    } catch (err) {
      if (err.name === 'AbortError') break
      onProgress?.({ type: 'error', index: i, message: err.message })
      results.push({ index: i, slideText: slide.text, isTitle: slide.isTitle, error: err.message })
      continue
    }

    if (signal.aborted) break
    onProgress?.({ type: 'yaml-complete', index: i, yaml: yamlPrompt })

    // ステップ2: 背景画像生成
    const imagePrompt = yamlToImagePrompt(yamlPrompt)

    onProgress?.({
      type: 'slide-start',
      index: i,
      total: slides.length,
      step: 'image',
      message: `スライド ${i + 1}/${slides.length}: 背景画像生成中...`,
    })

    try {
      let result
      if (detectedProvider === 'google') {
        result = await googleGenerateImage(apiKey, imagePrompt, aspectRatio, model, characterImageDataUrl, signal)
      } else {
        result = await openaiGenerateImage(apiKey, imagePrompt, aspectRatio, model, signal)
      }

      results.push({
        index: i,
        slideText: slide.text,
        isTitle: slide.isTitle,
        yamlPrompt,
        imagePrompt,
        bgImageUrl: result.url,
      })

      onProgress?.({
        type: 'slide-complete',
        index: i,
        total: slides.length,
        result: results[results.length - 1],
      })
    } catch (err) {
      if (err.name === 'AbortError') break
      onProgress?.({ type: 'error', index: i, message: err.message })
      results.push({ index: i, slideText: slide.text, isTitle: slide.isTitle, yamlPrompt, error: err.message })
    }
  }

  if (signal.aborted) {
    onProgress?.({ type: 'stopped', completedCount: results.length })
  } else {
    onProgress?.({ type: 'done', results })
  }

  return results
}
