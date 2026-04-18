"use node"
import { internalAction } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

// ─── Internal action: check all vehicles and send due notifications ───────────

export const sendDueNotifications = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("[notifications] Starting daily notification check")

    const vehicles = await ctx.runQuery(internal.notificationHelpers.getAllVehiclesForNotify, {})
    console.log(`[notifications] Found ${vehicles.length} vehicles to check`)

    const endpoint = process.env.EMAIL_NOTIFICATION_ENDPOINT
    const recipientEmail = process.env.RECIPIENT_EMAIL
    const chatId = process.env.CHAT_ID
    const appName = process.env.APP_NAME
    const secretKey = process.env.SECRET_KEY

    if (!endpoint || !recipientEmail || !chatId || !appName || !secretKey) {
      console.log("[notifications] Missing env vars, skipping email send")
      return null
    }

    const now = Date.now()

    function daysUntil(ts: number) {
      return Math.ceil((ts - now) / (1000 * 60 * 60 * 24))
    }

    function calcNextStk(firstRegTs: number): number {
      const firstStk = new Date(firstRegTs)
      firstStk.setFullYear(firstStk.getFullYear() + 4)
      let next = new Date(firstStk)
      while (next.getTime() <= now) {
        next = new Date(next)
        next.setFullYear(next.getFullYear() + 2)
      }
      return next.getTime()
    }

    function nextMonthDate(month: number): number {
      const d = new Date()
      const candidate = new Date(d.getFullYear(), month - 1, 1)
      if (candidate.getTime() <= now) candidate.setFullYear(d.getFullYear() + 1)
      return candidate.getTime()
    }

    for (const vehicle of vehicles) {
      const checks: { type: "stk" | "insurance" | "service" | "tires"; label: string; dueDate: number; notifyDays: number }[] = []

      // STK
      const stkTs = vehicle.stkDate ?? (vehicle.firstRegistrationDate ? calcNextStk(vehicle.firstRegistrationDate) : undefined)
      if (stkTs) {
        checks.push({ type: "stk", label: "STK", dueDate: stkTs, notifyDays: vehicle.notifyStkDays ?? 60 })
      }

      // Insurance
      if (vehicle.insuranceExpiryDate) {
        checks.push({ type: "insurance", label: "Pojistka", dueDate: vehicle.insuranceExpiryDate, notifyDays: vehicle.notifyInsuranceDays ?? 60 })
      }

      // Service (yearly from last service date)
      if (vehicle.serviceLastDate) {
        const nextServiceTs = vehicle.serviceLastDate + 365 * 24 * 60 * 60 * 1000
        checks.push({ type: "service", label: "Servis", dueDate: nextServiceTs, notifyDays: vehicle.notifyServiceDays ?? 60 })
      }

      // Tires
      const springMonth = vehicle.tiresSpringMonth ?? 4
      const autumnMonth = vehicle.tiresAutumnMonth ?? 10
      const nextSpringTs = nextMonthDate(springMonth)
      const nextAutumnTs = nextMonthDate(autumnMonth)
      const nextTiresTs = nextSpringTs < nextAutumnTs ? nextSpringTs : nextAutumnTs
      const tiresLabel = nextSpringTs < nextAutumnTs ? "Přezutí na letní" : "Přezutí na zimní"
      checks.push({ type: "tires", label: tiresLabel, dueDate: nextTiresTs, notifyDays: vehicle.notifyTiresDays ?? 30 })

      for (const check of checks) {
        const days = daysUntil(check.dueDate)
        if (days > check.notifyDays || days < 0) continue

        const alreadySent = await ctx.runQuery(internal.notificationHelpers.checkAlreadySent, {
          vehicleId: vehicle._id,
          type: check.type,
          dueDate: check.dueDate,
        })
        if (alreadySent) continue

        const dueStr = new Date(check.dueDate).toLocaleDateString("cs-CZ")
        const message = `Připomínka pro vozidlo ${vehicle.name}: ${check.label} – termín ${dueStr} (za ${days} dní)`

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toEmail: recipientEmail,
              subject: `AutoÚčtenky: ${check.label} za ${days} dní – ${vehicle.name}`,
              message,
              chatId,
              appName,
              secretKey,
            }),
          })
          if (!res.ok) {
            console.log(`[notifications] Email failed for ${vehicle.name} ${check.type}: ${res.status}`)
            continue
          }
          console.log(`[notifications] Sent notification for ${vehicle.name} ${check.type}`)

          await ctx.runMutation(internal.notificationHelpers.recordSent, {
            vehicleId: vehicle._id,
            type: check.type,
            dueDate: check.dueDate,
          })
        } catch (e) {
          console.log(`[notifications] Error sending email: ${e}`)
        }
      }
    }

    // ─── Vignette expiration checks ─────────────────────────────────────────
    for (const vehicle of vehicles) {
      const vignettes = await ctx.runQuery(internal.notificationHelpers.getAllVignettesByVehicle, {
        vehicleId: vehicle._id,
      })

      for (const vignette of vignettes) {
        const days = daysUntil(vignette.validUntil)

        // Only notify at milestones: 30, 14, 7, 0 days before expiry
        const milestone = [30, 14, 7, 0].find((m) => days <= m && days >= (m === 0 ? 0 : m - 6))
        if (milestone === undefined) continue
        if (days < 0) continue // already well expired, stop spamming

        // Update status server-side
        const newStatus = days <= 0 ? "expired" : days <= 30 ? "expiring_soon" : "active"
        await ctx.runMutation(internal.notificationHelpers.updateVignetteStatus, {
          vignetteId: vignette._id,
          status: newStatus,
        })

        // Dedup: use validUntil as dueDate, scoped to this vignette
        const alreadySent = await ctx.runQuery(internal.notificationHelpers.checkAlreadySentVignette, {
          vehicleId: vehicle._id,
          vignetteId: vignette._id,
          dueDate: vignette.validUntil,
        })
        if (alreadySent) continue

        const dueStr = new Date(vignette.validUntil).toLocaleDateString("cs-CZ")
        const daysLabel = days <= 0 ? "dnes vyprší" : `vyprší za ${days} dní`
        const urgency = days <= 7 ? "⚠️ " : ""
        const message = `${urgency}Dálniční známka ${vignette.country} pro ${vignette.licensePlate} ${daysLabel} (${dueStr}).`

        try {
          const res = await fetch(endpoint!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toEmail: recipientEmail,
              subject: `AutoÚčtenky: Dálniční známka ${vignette.country} ${daysLabel} — ${vignette.licensePlate}`,
              message,
              chatId,
              appName,
              secretKey,
            }),
          })
          if (!res.ok) {
            console.log(`[notifications] Vignette email failed for ${vignette._id}: ${res.status}`)
            continue
          }
          console.log(`[notifications] Sent vignette notification for ${vehicle.name} (${vignette.country}, ${days} days left)`)

          await ctx.runMutation(internal.notificationHelpers.recordSentVignette, {
            vehicleId: vehicle._id,
            vignetteId: vignette._id,
            dueDate: vignette.validUntil,
          })
        } catch (e) {
          console.log(`[notifications] Error sending vignette email: ${e}`)
        }
      }
    }

    return null
  },
})
