import { NextRequest, NextResponse } from "next/server"

interface OcrImage {
  imageBase64: string
  mimeType: string
}

interface OcrResult {
  spz: string | null
  brand: string | null
  model: string | null
  yearManufactured: number | null
  vin: string | null
  color: string | null
  fuelType: string | null
  engineCcm: number | null
  powerKw: number | null
  firstRegistrationDate: string | null
  confidence: "high" | "medium" | "low"
}

async function analyzeOnePage(
  image: OcrImage,
  headers: Record<string, string>,
  baseUrl: string,
  chatId: string,
): Promise<OcrResult> {
  const llmBody = {
    chatId,
    preset: "FAST",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at reading Czech vehicle registration certificates (technický průkaz / velký TP). Extract vehicle data accurately and respond with ONLY valid JSON, no markdown, no explanation.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a page from a Czech vehicle registration certificate (technický průkaz / velký TP). Extract all vehicle data you can find. Respond with ONLY this JSON structure (no markdown, just raw JSON):
{
  "spz": "string or null",
  "brand": "string or null",
  "model": "string or null",
  "yearManufactured": number or null,
  "vin": "string or null",
  "color": "string or null",
  "fuelType": "benzin" | "diesel" | "hybrid" | "elektro" | "lpg" | "other" | null,
  "engineCcm": number or null,
  "powerKw": number or null,
  "firstRegistrationDate": "YYYY-MM-DD or null",
  "confidence": "high" | "medium" | "low"
}

Rules:
- spz: registration plate (e.g. "1AB 2345")
- brand: manufacturer name (výrobce/značka, e.g. "Škoda", "Volkswagen")
- model: model name (typ/model, e.g. "Octavia", "Golf")
- yearManufactured: year of manufacture (rok výroby) as a 4-digit number
- vin: VIN/chassis number (VIN/číslo karoserie), 17 characters
- color: vehicle color (barva)
- fuelType: map Czech text → "benzin" (benzin/petrol/BA), "diesel" (nafta/diesel/NA), "hybrid", "elektro" (elektro/EV), "lpg" (LPG/propan), "other"
- engineCcm: engine displacement in cm³ (zdvihový objem, e.g. 1598)
- powerKw: engine power in kW (výkon, e.g. 85)
- firstRegistrationDate: date of first registration (datum první registrace) in YYYY-MM-DD format
- confidence: "high" if 5+ fields found, "medium" if 3-4 found, "low" if fewer than 3`,
          },
          {
            type: "image",
            image: image.imageBase64,
            mediaType: image.mimeType,
          },
        ],
      },
    ],
  }

  const response = await fetch(`${baseUrl}/api/client-app/llm-usage`, {
    method: "POST",
    headers,
    body: JSON.stringify(llmBody),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error("LLM API error:", response.status, errText)
    return { spz: null, brand: null, model: null, yearManufactured: null, vin: null, color: null, fuelType: null, engineCcm: null, powerKw: null, firstRegistrationDate: null, confidence: "low" }
  }

  const data = await response.json()
  console.log("LLM TP raw response:", data.text?.substring(0, 300))

  if (!data.text) {
    return { spz: null, brand: null, model: null, yearManufactured: null, vin: null, color: null, fuelType: null, engineCcm: null, powerKw: null, firstRegistrationDate: null, confidence: "low" }
  }

  try {
    const cleaned = data.text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim()
    return JSON.parse(cleaned) as OcrResult
  } catch {
    console.error("Failed to parse TP OCR JSON:", data.text)
    return { spz: null, brand: null, model: null, yearManufactured: null, vin: null, color: null, fuelType: null, engineCcm: null, powerKw: null, firstRegistrationDate: null, confidence: "low" }
  }
}

function mergeResults(results: OcrResult[]): OcrResult {
  const merged: OcrResult = {
    spz: null,
    brand: null,
    model: null,
    yearManufactured: null,
    vin: null,
    color: null,
    fuelType: null,
    engineCcm: null,
    powerKw: null,
    firstRegistrationDate: null,
    confidence: "low",
  }

  // Take first non-null value from any page for each field
  for (const r of results) {
    if (!merged.spz && r.spz) merged.spz = r.spz
    if (!merged.brand && r.brand) merged.brand = r.brand
    if (!merged.model && r.model) merged.model = r.model
    if (!merged.yearManufactured && r.yearManufactured) merged.yearManufactured = r.yearManufactured
    if (!merged.vin && r.vin) merged.vin = r.vin
    if (!merged.color && r.color) merged.color = r.color
    if (!merged.fuelType && r.fuelType) merged.fuelType = r.fuelType
    if (!merged.engineCcm && r.engineCcm) merged.engineCcm = r.engineCcm
    if (!merged.powerKw && r.powerKw) merged.powerKw = r.powerKw
    if (!merged.firstRegistrationDate && r.firstRegistrationDate) merged.firstRegistrationDate = r.firstRegistrationDate
  }

  // Calculate confidence based on total fields found
  const fieldCount = [
    merged.spz, merged.brand, merged.model, merged.yearManufactured,
    merged.vin, merged.color, merged.fuelType, merged.engineCcm,
    merged.powerKw, merged.firstRegistrationDate,
  ].filter(Boolean).length

  merged.confidence = fieldCount >= 5 ? "high" : fieldCount >= 3 ? "medium" : "low"

  return merged
}

export async function POST(req: NextRequest) {
  try {
    // Support single image (legacy) or array of images (multi-page TP)
    const body = await req.json()
    const images: OcrImage[] = body.images ?? [
      { imageBase64: body.imageBase64, mimeType: body.mimeType },
    ]

    if (!images.length || !images[0].imageBase64) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 })
    }

    console.log("TP OCR request received, pages:", images.length)

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

    // Process each page separately, then merge results
    console.log("Calling Macaly LLM API for TP OCR, processing", images.length, "page(s) separately")
    const results = await Promise.all(
      images.map((img) => analyzeOnePage(img, headers, baseUrl, chatId))
    )

    console.log("Individual page results:", results.map(r => ({ confidence: r.confidence, fields: Object.entries(r).filter(([k, v]) => v && k !== 'confidence').map(([k]) => k) })))

    const merged = images.length > 1 ? mergeResults(results) : results[0]

    console.log("TP OCR final result:", merged)

    return NextResponse.json(merged)
  } catch (err) {
    console.error("TP OCR route error:", err)
    return NextResponse.json({ confidence: "low" })
  }
}
