/**
 * Canvas ベースのスライド合成エンジン
 *
 * 背景画像の上にデザインルールに従ってテキストを合成し、
 * 完成スライド画像を出力する。
 *
 * テキストが1枚に収まらない場合は、同じ背景で複数ページに自動分割。
 * 各関数は [{ url, pageText }] の配列を返す。
 */

const SLIDE_WIDTH = 1920
const SLIDE_HEIGHT = 1080

// ── ユーティリティ ──────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = src
  })
}

async function ensureFont(fontFamily, weight) {
  try {
    await document.fonts.load(`${weight} 48px "${fontFamily}"`)
  } catch {
    // フォールバック
  }
}

/** テキストを指定幅で折り返し、各行を返す */
function wrapText(ctx, text, maxWidth) {
  const lines = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    let currentLine = ''
    for (const char of paragraph) {
      const testLine = currentLine + char
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
  }

  return lines
}

/** 画像をカバー（cover）で描画 */
function drawCover(ctx, img, dx, dy, dw, dh) {
  const imgAspect = img.width / img.height
  const targetAspect = dw / dh
  let sx, sy, sw, sh
  if (imgAspect > targetAspect) {
    sh = img.height
    sw = sh * targetAspect
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / targetAspect
    sx = 0
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

/**
 * 段落単位でページ分割する
 * paragraphs: 原文の行（\n split）
 * ctx: measureText用のCanvasコンテキスト
 * maxWidth: テキストボックスの幅
 * maxLinesPerPage: 1ページの最大行数
 * → ページごとのテキスト文字列の配列を返す
 */
function splitIntoPages(paragraphs, ctx, maxWidth, maxLinesPerPage) {
  const pages = []
  let currentPageParas = []
  let currentLineCount = 0

  for (const para of paragraphs) {
    const visualLines = para.trim() === ''
      ? 1
      : wrapText(ctx, para, maxWidth).length

    if (currentLineCount + visualLines > maxLinesPerPage && currentPageParas.length > 0) {
      // 現在のページを確定、新しいページへ
      pages.push(currentPageParas.join('\n'))
      currentPageParas = [para]
      currentLineCount = visualLines
    } else {
      currentPageParas.push(para)
      currentLineCount += visualLines
    }
  }

  if (currentPageParas.length > 0) {
    pages.push(currentPageParas.join('\n'))
  }

  return pages
}

// ── スライド1（タイトル・目次）─────────────────────────

export async function compositeTitle(bgImageUrl, text, options = {}) {
  const {
    fontFamily = 'Noto Sans JP',
    fontWeight = '700',
    titleFontSize = 52,
    itemFontSize = 30,
  } = options

  await ensureFont(fontFamily, fontWeight)
  await ensureFont(fontFamily, '300')
  await ensureFont(fontFamily, '500')

  const bgImg = await loadImage(bgImageUrl)
  const url = renderTitleSlide(bgImg, text, { fontFamily, fontWeight, titleFontSize, itemFontSize })
  return [{ url, pageText: text }]
}

function renderTitleSlide(bgImg, text, opts) {
  const { fontFamily, fontWeight, titleFontSize, itemFontSize } = opts

  const canvas = document.createElement('canvas')
  canvas.width = SLIDE_WIDTH
  canvas.height = SLIDE_HEIGHT
  const ctx = canvas.getContext('2d')

  const leftW = Math.floor(SLIDE_WIDTH * 0.5)
  const rightW = SLIDE_WIDTH - leftW

  // 左側: 白背景
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, leftW, SLIDE_HEIGHT)

  // 右側: 背景画像
  drawCover(ctx, bgImg, leftW, 0, rightW, SLIDE_HEIGHT)

  // テキスト解析
  const rawLines = text.split('\n').map(l => l.trim())
  const title = rawLines[0] || ''
  const items = rawLines.slice(1).filter(l => l)

  // "Memo." 左上
  ctx.fillStyle = '#AAAAAA'
  ctx.font = `300 22px "${fontFamily}"`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('Memo.', 50, 40)

  // タイトル: 左半分の中央
  ctx.fillStyle = '#000000'
  ctx.font = `${fontWeight} ${titleFontSize}px "${fontFamily}"`
  ctx.textBaseline = 'alphabetic'
  const titleMaxW = leftW - 100
  const titleLines = wrapText(ctx, title, titleMaxW)
  const titleLineH = titleFontSize * 1.4
  const titleBlockH = titleLines.length * titleLineH
  const totalH = titleBlockH + (items.length > 0 ? 30 + items.length * (itemFontSize * 1.6) : 0)
  let startY = (SLIDE_HEIGHT - totalH) / 2 + titleFontSize

  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], 50, startY + i * titleLineH)
  }

  // リスト項目
  if (items.length > 0) {
    const itemLineH = itemFontSize * 1.6
    let itemY = startY + titleLines.length * titleLineH + 30

    for (const item of items) {
      ctx.font = `500 ${itemFontSize}px "${fontFamily}"`
      const numMatch = item.match(/^(\d+[\.\)）]?\s*)(.*)/)
      if (numMatch) {
        ctx.fillStyle = '#DC2626'
        ctx.fillText(numMatch[1], 50, itemY)
        const numW = ctx.measureText(numMatch[1]).width
        ctx.fillStyle = '#000000'
        ctx.fillText(numMatch[2], 50 + numW, itemY)
      } else {
        ctx.fillStyle = '#000000'
        ctx.fillText(item, 50, itemY)
      }
      itemY += itemLineH
    }
  }

  // 右側: 箇条書きがあればチェックマーク付きで表示
  const rightItems = items.filter(l => l)
  if (rightItems.length > 0) {
    const rItemSize = 28
    const rLineH = rItemSize * 2
    const rStartY = (SLIDE_HEIGHT - rightItems.length * rLineH) / 2 + rItemSize
    ctx.font = `${fontWeight} ${rItemSize}px "${fontFamily}"`

    for (let i = 0; i < rightItems.length; i++) {
      const y = rStartY + i * rLineH
      const textW = ctx.measureText(rightItems[i]).width
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(leftW + 40, y - rItemSize - 4, textW + 70, rItemSize * 1.8)

      ctx.fillStyle = '#16A34A'
      ctx.font = `${fontWeight} ${rItemSize}px sans-serif`
      ctx.fillText('✓', leftW + 50, y)

      ctx.fillStyle = '#000000'
      ctx.font = `${fontWeight} ${rItemSize}px "${fontFamily}"`
      ctx.fillText(rightItems[i], leftW + 85, y)
    }
  }

  return canvas.toDataURL('image/png')
}

// ── スライド2以降（コンテンツ）────────────────────────

export async function compositeContent(bgImageUrl, text, options = {}) {
  const {
    fontFamily = 'Noto Sans JP',
    fontWeight = '700',
    contentFontSize = 44,
  } = options

  await ensureFont(fontFamily, fontWeight)

  const bgImg = await loadImage(bgImageUrl)

  // テキスト分割用の計測
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  measureCtx.font = `${fontWeight} ${contentFontSize}px "${fontFamily}"`

  const boxPadX = 30
  const boxPadY = 20
  const maxTextW = SLIDE_WIDTH * 0.42 - boxPadX * 2
  const lineH = contentFontSize * 1.5
  const maxBoxH = SLIDE_HEIGHT - 120
  const maxLinesPerPage = Math.floor((maxBoxH - boxPadY * 2) / lineH)

  // 段落単位でページ分割
  const paragraphs = text.split('\n')
  const pageTexts = splitIntoPages(paragraphs, measureCtx, maxTextW, maxLinesPerPage)

  // 各ページをレンダリング
  const results = []
  for (const pageText of pageTexts) {
    const url = renderContentSlide(bgImg, pageText, {
      fontFamily, fontWeight, contentFontSize, boxPadX, boxPadY, maxTextW, lineH,
    })
    results.push({ url, pageText })
  }

  return results
}

function renderContentSlide(bgImg, text, opts) {
  const { fontFamily, fontWeight, contentFontSize, boxPadX, boxPadY, lineH } = opts
  const maxTextW = SLIDE_WIDTH * 0.42 - boxPadX * 2

  const canvas = document.createElement('canvas')
  canvas.width = SLIDE_WIDTH
  canvas.height = SLIDE_HEIGHT
  const ctx = canvas.getContext('2d')

  // 背景画像（全面）
  drawCover(ctx, bgImg, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)

  // 黒グラデーション（40%）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)

  // テキスト計算
  ctx.font = `${fontWeight} ${contentFontSize}px "${fontFamily}"`
  const textLines = wrapText(ctx, text.trim(), maxTextW)

  const fullBoxW = maxTextW + boxPadX * 2
  const boxH = textLines.length * lineH + boxPadY * 2 + contentFontSize * 0.3
  const boxX = 80
  const boxY = (SLIDE_HEIGHT - boxH) / 2

  // 白テキストボックス（角丸なし・影なし）
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(boxX, boxY, fullBoxW, boxH)

  // テキスト描画
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (let i = 0; i < textLines.length; i++) {
    ctx.fillText(
      textLines[i],
      boxX + boxPadX,
      boxY + boxPadY + (i + 1) * lineH
    )
  }

  return canvas.toDataURL('image/png')
}

// ── 単一ページ再合成（編集用）────────────────────────

export async function recomposite(bgImageUrl, pageText, isTitle, options = {}) {
  if (isTitle) {
    const results = await compositeTitle(bgImageUrl, pageText, options)
    return results[0].url
  }

  const {
    fontFamily = 'Noto Sans JP',
    fontWeight = '700',
    contentFontSize = 44,
  } = options

  await ensureFont(fontFamily, fontWeight)

  const bgImg = await loadImage(bgImageUrl)
  const boxPadX = 30
  const boxPadY = 20
  const lineH = contentFontSize * 1.5

  return renderContentSlide(bgImg, pageText, {
    fontFamily, fontWeight, contentFontSize, boxPadX, boxPadY, lineH,
  })
}
