import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

// ─── Constants ────────────────────────────────────────────────────────────────

const PURCHASE_URLS: Record<string, string> = {
  CZ: "https://edalnice.cz/jednoduchy-nakup/index.html#/eshop/order/license",
}

const VIGNETTE_DAYS: Record<string, number> = {
  "1_day": 1,
  "10_day": 10,
  "30_day": 30,
  "365_day": 365,
}

// Status derived from validUntil and now
export function calcStatus(validUntil: number, now: number): "active" | "expiring_soon" | "expired" {
  const daysLeft = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return "expired"
  if (daysLeft <= 30) return "expiring_soon"
  return "active"
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listVignettes = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    // Security: must be a member
    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()
    if (!membership) return []

    const vignettes = await ctx.db
      .query("vignettes")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .collect()

    const now = Date.now()
    return vignettes.map((v) => ({
      ...v,
      status: calcStatus(v.validUntil, now),
      daysLeft: Math.ceil((v.validUntil - now) / (1000 * 60 * 60 * 24)),
    }))
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createVignette = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    country: v.string(),
    type: v.union(
      v.literal("1_day"),
      v.literal("10_day"),
      v.literal("30_day"),
      v.literal("365_day"),
    ),
    validFrom: v.number(),
    licensePlate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()
    if (!membership) throw new Error("Not a member of this vehicle")

    const days = VIGNETTE_DAYS[args.type]
    // validUntil = end of the last valid day (validFrom + days days, minus 1ms)
    const validUntil = args.validFrom + days * 24 * 60 * 60 * 1000 - 1

    const now = Date.now()
    const status = calcStatus(validUntil, now)

    console.log(`[vignettes] Creating ${args.country} ${args.type} for vehicle ${args.vehicleId}, validUntil: ${new Date(validUntil).toISOString()}`)

    return await ctx.db.insert("vignettes", {
      vehicleId: args.vehicleId,
      country: args.country,
      type: args.type,
      validFrom: args.validFrom,
      validUntil,
      licensePlate: args.licensePlate,
      purchaseUrl: PURCHASE_URLS[args.country],
      status,
      createdBy: userId,
      note: args.note,
    })
  },
})

export const deleteVignette = mutation({
  args: { vignetteId: v.id("vignettes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const vignette = await ctx.db.get(args.vignetteId)
    if (!vignette) throw new Error("Vignette not found")

    // Only owners can delete
    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", vignette.vehicleId).eq("userId", userId)
      )
      .unique()
    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can delete vignettes")
    }

    console.log(`[vignettes] Deleting vignette ${args.vignetteId}`)
    await ctx.db.delete(args.vignetteId)
  },
})
