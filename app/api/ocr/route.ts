import { NextRequest, NextResponse } from "next/server"

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
              text: `Extract data from this fuel/gas station receipt. Respond with ONLY this JSON structure (no markdown, just raw JSON):
{
  "date": "YYYY-MM-DD or null",
  "liters": number or null,
  "pricePerLiter": number or null,
  "totalAmountCzk": number or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- date: the transaction date in YYYY-MM-DD format, or null if not found
- liters: total liters/quantity dispensed as a number (look for: MNO, množství, Qty, litry, l, objem — typically 20–80 l)
- pricePerLiter: price per liter in CZK (look for: cena/l, Kč/l, jednotková cena, unit price — typically 35–65 Kč/l)
- totalAmountCzk: total amount paid in CZK (look for: celkem, total, částka — typically the largest bold number on receipt)
- If liters and totalAmountCzk found but pricePerLiter missing: calculate pricePerLiter = round(totalAmountCzk / liters, 2)
- If pricePerLiter and totalAmountCzk found but liters missing: calculate liters = round(totalAmountCzk / pricePerLiter, 2)
- confidence: "high" if liters + pricePerLiter both present (or calculated), "medium" if only one, "low" if neither
- Use Czech locale: decimal separator may be comma (convert to dot for JSON numbers)
- Czech receipt labels: Množství/MNO = liters, Cena/litr or JC = price per liter, Celkem/TOTAL = total paid`,
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

    // Parse JSON from response
    let parsed: Record<string, unknown>
    try {
      // Strip markdown code fences if present
      const cleaned = data.text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("Failed to parse LLM JSON response:", data.text)
      return NextResponse.json({ confidence: "low" })
    }

    console.log("OCR parsed result:", parsed)

    const normalizedDate = normalizeDate(parsed.date)
    let liters = toNumber(parsed.liters)
    let pricePerLiter = toNumber(parsed.pricePerLiter)
    const totalAmountCzk = toNumber(parsed.totalAmountCzk)

    // Server-side fallback calculation if LLM didn't already do it
    if (!liters && pricePerLiter && totalAmountCzk && pricePerLiter > 0) {
      liters = parseFloat((totalAmountCzk / pricePerLiter).toFixed(2))
      console.log("Calculated liters from total/ppl:", liters)
    }
    if (!pricePerLiter && liters && totalAmountCzk && liters > 0) {
      pricePerLiter = parseFloat((totalAmountCzk / liters).toFixed(2))
      console.log("Calculated pricePerLiter from total/liters:", pricePerLiter)
    }

    return NextResponse.json({
      date: normalizedDate,
      liters,
      pricePerLiter,
      totalAmountCzk,
      confidence: parsed.confidence ?? "low",
    })
  } catch (err) {
    console.error("OCR route error:", err)
    return NextResponse.json({ confidence: "low" })
  }
}
