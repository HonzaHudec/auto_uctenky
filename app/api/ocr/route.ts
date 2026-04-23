import { NextRequest, NextResponse } from "next/server"

type OcrConfidence = "high" | "medium" | "low"

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Keep digits, separators, and minus sign only
  const cleaned = trimmed.replace(/[^\d,.\-]/g, "")
  if (!cleaned) return null

  const hasComma = cleaned.includes(",")
  const hasDot = cleaned.includes(".")

  let normalized = cleaned
  if (hasComma && hasDot) {
    // 1.234,56 -> 1234.56
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".")
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null

  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  // Common receipt formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!match) return null

  const day = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  let year = Number.parseInt(match[3], 10)
  if (year < 100) year += 2000

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }

  // Plausibility check for receipts
  const min = new Date(Date.UTC(2000, 0, 1))
  const max = new Date()
  max.setUTCDate(max.getUTCDate() + 1)
  if (candidate < min || candidate > max) return null

  return `${year}-${pad2(month)}-${pad2(day)}`
}

function tryParseJsonObject(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim()

  const candidates: string[] = [cleaned]
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null
}

function extractLabeledNumber(text: string, labelPattern: RegExp): number | null {
  const m = text.match(labelPattern)
  if (!m) return null
  return toNumber(m[1] ?? null)
}

function extractTotalFallback(text: string): number | null {
  const pattern = /\b\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?\b/g
  const numbers: number[] = []

  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const value = toNumber(match[0])
    if (typeof value === "number" && value >= 50 && value <= 10000) {
      numbers.push(value)
    }
  }

  if (numbers.length === 0) return null
  return Math.max(...numbers)
}

function extractLitersFallback(text: string): number | null {
  const candidates = [
    /(?:mno[žz]stv[ií]|objem|litr[yůu]?)[^0-9]{0,20}(\d{1,3}(?:[.,]\d{1,3})?)/i,
    /\b(\d{1,3}(?:[.,]\d{1,3})?)\s*l\b/i,
  ]

  for (const pattern of candidates) {
    const match = text.match(pattern)
    const parsed = toNumber(match?.[1] ?? null)
    if (typeof parsed === "number" && parsed > 0 && parsed <= 300) {
      return parsed
    }
  }

  return null
}

function extractPricePerLiterFallback(text: string): number | null {
  const candidates = [
    /(?:cena\s*za\s*l|za\s*litr|jedn\.\s*cena)[^0-9]{0,20}(\d{1,3}(?:[.,]\d{1,3})?)/i,
    /\b(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:k[čc]\s*\/\s*l|czk\s*\/\s*l|\/\s*l)\b/i,
  ]

  for (const pattern of candidates) {
    const match = text.match(pattern)
    const parsed = toNumber(match?.[1] ?? null)
    if (typeof parsed === "number" && parsed > 0 && parsed <= 200) {
      return parsed
    }
  }

  return null
}

function extractFromRawText(rawText: string): Record<string, unknown> {
  const text = rawText.replace(/\s+/g, " ").trim()

  const dateMatch = text.match(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/)
  const totalAmountCzk =
    extractLabeledNumber(text, /(?:celkem|total|k\s*uhrad[eě]|[čc]ástka)[^0-9]{0,30}(\d{1,6}(?:[.,]\d{1,2})?)/i) ??
    extractTotalFallback(text)
  const liters =
    extractLabeledNumber(text, /(?:mno[žz]stv[ií]|objem|litr[yůu]?)[^0-9]{0,30}(\d{1,3}(?:[.,]\d{1,3})?)/i) ??
    extractLitersFallback(text)
  const pricePerLiter =
    extractLabeledNumber(text, /(?:cena\s*za\s*l|za\s*litr|jedn\.\s*cena)[^0-9]{0,30}(\d{1,3}(?:[.,]\d{1,3})?)/i) ??
    extractPricePerLiterFallback(text)

  return {
    date: dateMatch?.[1] ?? null,
    liters,
    pricePerLiter,
    totalAmountCzk,
  }
}

function computeConfidence(date: string | null, totalAmountCzk: number | null): OcrConfidence {
  if (date && totalAmountCzk) return "high"
  if (date || totalAmountCzk) return "medium"
  return "low"
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 })
    }

    console.log("OCR request received, mimeType:", mimeType)

    const baseUrl = process.env.MACALY_BASE_URL
    const apiToken = process.env.MACALY_API_TOKEN
    const chatId = process.env.MACALY_CHAT_ID
    const bypassHeader = process.env.MACALY_BYPASS_HEADER

    if (!baseUrl || !apiToken || !chatId) {
      console.error("Missing LLM env vars")
      return NextResponse.json({ confidence: "low" })
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    }

    if (bypassHeader) {
      const [key, value] = bypassHeader.split(": ")
      if (key && value) headers[key] = value
    }

    const body = {
      chatId,
      preset: "FAST",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at reading fuel/gas station receipts. Extract data accurately and respond with ONLY valid JSON, no markdown, no explanation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract only date and total amount from this fuel/gas station receipt.
Respond with ONLY this JSON structure (no markdown, just raw JSON):
{
  "date": "YYYY-MM-DD or null",
  "liters": number or null,
  "pricePerLiter": number or null,
  "totalAmountCzk": number or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- date: the transaction date in YYYY-MM-DD format, or null if not found
- liters: fuel quantity in liters (or kWh for charging), or null if not found
- pricePerLiter: unit price in CZK/l (or CZK/kWh), or null if not found
- totalAmountCzk: total amount paid in CZK (look for: celkem, total, částka — typically the largest bold number on receipt)
- confidence: "high" if at least date and totalAmountCzk found, "medium" if only one key field found, "low" if almost nothing found
- Use Czech locale: decimal separator may be comma (convert to dot for JSON numbers)
- Czech receipt labels: Datum = transaction date, Celkem/TOTAL = total paid`,
            },
            {
              type: "image",
              image: imageBase64,
              mediaType: mimeType,
            },
          ],
        },
      ],
    }

    console.log("Calling Macaly LLM API for OCR...")
    const response = await fetch(`${baseUrl}/api/client-app/llm-usage`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("LLM API error:", response.status, errText)
      return NextResponse.json({ confidence: "low" })
    }

    const data = await response.json()
    console.log("LLM raw response:", data.text?.substring(0, 200))

    if (!data.text) {
      return NextResponse.json({ confidence: "low" })
    }

    const parsed = tryParseJsonObject(data.text) ?? extractFromRawText(data.text)

    console.log("OCR parsed result:", parsed)

    const normalizedDate = normalizeDate(parsed.date)
    const liters = toNumber(parsed.liters)
    const pricePerLiter = toNumber(parsed.pricePerLiter)
    const totalAmountCzk = toNumber(parsed.totalAmountCzk)

    const confidence: OcrConfidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : computeConfidence(normalizedDate, totalAmountCzk)

    return NextResponse.json({
      date: normalizedDate,
      liters,
      pricePerLiter,
      totalAmountCzk,
      confidence,
    })
  } catch (err) {
    console.error("OCR route error:", err)
    return NextResponse.json({ confidence: "low" })
  }
}
