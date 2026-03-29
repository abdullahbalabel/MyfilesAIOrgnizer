import { GoogleGenerativeAI } from '@google/generative-ai'

const BATCH_SIZE = 50

// onProgress(filesProcessed, totalFiles, batchNum, totalBatches)
export async function classifyFiles(files, apiKey, customRules = '', onProgress) {
  const totalBatches = Math.ceil(files.length / BATCH_SIZE)
  const results = []

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batch = files.slice(i, i + BATCH_SIZE)

    // Report progress BEFORE the batch starts
    onProgress?.(i, files.length, batchNum, totalBatches)

    // ── Electron path: one IPC call per batch ────────────────
    if (window.electron?.classifyBatch) {
      const result = await window.electron.classifyBatch(batch, batchNum, totalBatches, apiKey, customRules)
      results.push(...(result?.data || fallbackBatch(batch)))
    } else {
      // ── Browser path: direct SDK call ────────────────────
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
        const batchResult = await classifyBatchDirect(model, batch, customRules)
        results.push(...batchResult)
      } catch {
        results.push(...fallbackBatch(batch))
      }
    }

    // Small breathing room between batches — prevents Electron from starving
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  // Final progress tick
  onProgress?.(files.length, files.length, totalBatches, totalBatches)
  return results
}

// ── Fallback when a batch fails ──────────────────────────────
function fallbackBatch(files) {
  return files.map((file) => ({
    ...file,
    suggestedFolder: file.category || 'Other',
    aiCategory: file.category,
    confidence: 0.5,
    reason: 'Fallback: classified by file extension',
    originalPath: file.path,
  }))
}

// ── Direct SDK path (browser / dev mode) ─────────────────────
async function classifyBatchDirect(model, files, customRules) {
  const fileList = files.map((f, idx) => ({
    idx, name: f.name, ext: f.ext,
    size: f.sizeFormatted,
    modified: f.modified?.split('T')[0],
    category: f.category,
  }))

  const prompt = `You are an expert file organizer AI. Classify these files into a logical folder structure.
Categories: Documents, Spreadsheets, Presentations, Images, Videos, Audio, Archives, Code, Design, Applications, Other
${customRules ? `\nUser rules:\n${customRules}` : ''}

Files:
${JSON.stringify(fileList, null, 2)}

Rules:
1. Use max 2-level folder paths like "Documents/Reports"
2. Return ONLY a JSON array, no markdown:
[{"idx":0,"suggestedFolder":"Documents/Reports","category":"Documents","confidence":0.95,"reason":"PDF report"}]`

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Batch timeout')), 45000)
  )

  const resp = await Promise.race([model.generateContent(prompt), timeout])
  const text = resp.response.text().trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []

  return files.map((file, localIdx) => {
    const ai = parsed.find((r) => r.idx === localIdx)
    return {
      ...file,
      suggestedFolder: ai?.suggestedFolder || file.category || 'Other',
      aiCategory: ai?.category || file.category,
      confidence: ai?.confidence || 0.7,
      reason: ai?.reason || 'Classified by extension',
      originalPath: file.path,
    }
  })
}

export async function testApiKey(apiKey) {
  if (window.electron?.testApiKey) {
    const result = await window.electron.testApiKey(apiKey)
    return result?.valid === true
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
    const result = await model.generateContent('Say hello')
    const text = result.response.text()
    return typeof text === 'string' && text.length > 0
  } catch (err) {
    console.error('[testApiKey direct error]', err?.message)
    return false
  }
}
