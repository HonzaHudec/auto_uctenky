import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

async function assertMember(ctx: any, vehicleId: any, userId: any) {
  const membership = await ctx.db
    .query("vehicleMembers")
    .withIndex("by_vehicle_user", (q: any) =>
      q.eq("vehicleId", vehicleId).eq("userId", userId)
    )
    .unique()
  if (!membership) throw new Error("Not a member of this vehicle")
  return membership
}

export const listExpenses = query({
  args: {
    vehicleId: v.id("vehicles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership) return []

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .take(args.limit ?? 100)

    return expenses
  },
})

export const getExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const expense = await ctx.db.get(args.expenseId)
    if (!expense) return null

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", expense.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership) return null

    return expense
  },
})

export const createFuelExpense = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    date: v.number(),
    fuelSubtype: v.optional(v.union(
      v.literal("benzin"),
      v.literal("nafta"),
      v.literal("elektrina"),
    )),
    liters: v.number(),
    pricePerLiter: v.number(),
    odometerKmTotal: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    await assertMember(ctx, args.vehicleId, userId)

    const amountCzk = parseFloat((args.liters * args.pricePerLiter).toFixed(2))

    // Find previous fuel expenses to compute distance & consumption
    const prevExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .filter((q) => q.eq(q.field("type"), "fuel"))
      .take(20)

    const prevExpense = prevExpenses.find(
      (e) => e.date <= args.date && e.odometerKmTotal !== undefined
    )

    let distanceKm: number | undefined
    let consumptionLPer100: number | undefined
    let needsReview = false

    if (prevExpense?.odometerKmTotal !== undefined) {
      distanceKm = args.odometerKmTotal - prevExpense.odometerKmTotal
      if (distanceKm <= 0 || distanceKm > 5000) {
        needsReview = true
        distanceKm = undefined
        consumptionLPer100 = undefined
      } else {
        consumptionLPer100 = parseFloat(
          (args.liters / (distanceKm / 100)).toFixed(2)
        )
        if (consumptionLPer100 > 50 || consumptionLPer100 < 2) {
          needsReview = true
        }
      }
    }

    const expenseId = await ctx.db.insert("expenses", {
      vehicleId: args.vehicleId,
      type: "fuel",
      date: args.date,
      amountCzk,
      note: args.note,
      createdBy: userId,
      fuelSubtype: args.fuelSubtype,
      liters: args.liters,
      pricePerLiter: args.pricePerLiter,
      odometerKmTotal: args.odometerKmTotal,
      distanceKm,
      consumptionLPer100,
      needsReview,
    })

    return expenseId
  },
})

export const createOtherExpense = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    type: v.union(
      v.literal("car_wash"),
      v.literal("service"),
      v.literal("tires"),
      v.literal("insurance"),
      v.literal("installment"),
      v.literal("other"),
      v.literal("expense"),
    ),
    date: v.number(),
    amountCzk: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    await assertMember(ctx, args.vehicleId, userId)

    return await ctx.db.insert("expenses", {
      vehicleId: args.vehicleId,
      type: args.type,
      date: args.date,
      amountCzk: args.amountCzk,
      note: args.note,
      createdBy: userId,
    })
  },
})

export const updateFuelExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
    date: v.optional(v.number()),
    fuelSubtype: v.optional(v.union(
      v.literal("benzin"),
      v.literal("nafta"),
      v.literal("elektrina"),
    )),
    liters: v.optional(v.number()),
    pricePerLiter: v.optional(v.number()),
    odometerKmTotal: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const expense = await ctx.db.get(args.expenseId)
    if (!expense) throw new Error("Expense not found")

    const membership = await assertMember(ctx, expense.vehicleId, userId)

    if (membership.role !== "owner" && expense.createdBy !== userId) {
      throw new Error("Not authorized to edit this expense")
    }

    const patch: Record<string, unknown> = {}
    if (args.date !== undefined) patch.date = args.date
    if (args.note !== undefined) patch.note = args.note
    if (args.fuelSubtype !== undefined) patch.fuelSubtype = args.fuelSubtype
    if (args.liters !== undefined) patch.liters = args.liters
    if (args.pricePerLiter !== undefined) patch.pricePerLiter = args.pricePerLiter
    if (args.odometerKmTotal !== undefined)
      patch.odometerKmTotal = args.odometerKmTotal

    const liters = args.liters ?? expense.liters
    const ppl = args.pricePerLiter ?? expense.pricePerLiter
    if (liters !== undefined && ppl !== undefined) {
      patch.amountCzk = parseFloat((liters * ppl).toFixed(2))
    }

    await ctx.db.patch(args.expenseId, patch)
  },
})

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const expense = await ctx.db.get(args.expenseId)
    if (!expense) throw new Error("Expense not found")

    const membership = await assertMember(ctx, expense.vehicleId, userId)

    if (membership.role !== "owner" && expense.createdBy !== userId) {
      throw new Error("Not authorized to delete this expense")
    }

    await ctx.db.delete(args.expenseId)
  },
})

export const getDashboardStats = query({
  args: {
    vehicleId: v.id("vehicles"),
    fromDate: v.number(),
    toDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership) return null

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.fromDate),
          q.lte(q.field("date"), args.toDate)
        )
      )
      .collect()

    const fuelExpenses = allExpenses.filter((e) => e.type === "fuel")
    const otherExpenses = allExpenses.filter((e) => e.type !== "fuel")

    const fuelTotal = fuelExpenses.reduce((sum, e) => sum + e.amountCzk, 0)
    const otherTotal = otherExpenses.reduce((sum, e) => sum + e.amountCzk, 0)
    const totalCost = fuelTotal + otherTotal

    const distanceTotal = fuelExpenses.reduce(
      (sum, e) => sum + (e.distanceKm ?? 0),
      0
    )
    const costPerKm = distanceTotal > 0 ? totalCost / distanceTotal : null

    // Correct avg consumption: total liters / total distance * 100
    const fuelWithDistance = fuelExpenses.filter(
      (e) => e.liters !== undefined && e.distanceKm !== undefined && e.distanceKm > 0 && !e.needsReview
    )
    const totalLitersForAvg = fuelWithDistance.reduce((sum, e) => sum + (e.liters ?? 0), 0)
    const totalDistanceForAvg = fuelWithDistance.reduce((sum, e) => sum + (e.distanceKm ?? 0), 0)
    const avgConsumption = totalDistanceForAvg > 0
      ? parseFloat(((totalLitersForAvg / totalDistanceForAvg) * 100).toFixed(2))
      : null

    // Last 5 fuel records for chart
    const recentFuel = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .filter((q) => q.eq(q.field("type"), "fuel"))
      .take(5)

    // Variable costs: fuel + car_wash + other + expense + tires (not service/insurance/installment)
    const variableCost = allExpenses
      .filter((e) => ["fuel", "car_wash", "other", "expense", "tires"].includes(e.type))
      .reduce((sum, e) => sum + e.amountCzk, 0)
    const costPerKmVariable = distanceTotal > 0 ? variableCost / distanceTotal : null

    return {
      fuelTotal,
      otherTotal,
      totalCost,
      distanceTotal,
      costPerKm,
      costPerKmVariable,
      avgConsumption,
      fuelCount: fuelExpenses.length,
      totalCount: allExpenses.length,
      recentFuel: recentFuel.reverse(),
    }
  },
})

export const getCostsByPeriod = query({
  args: {
    vehicleId: v.id("vehicles"),
    mode: v.union(v.literal("months"), v.literal("years"), v.literal("all")),
    // For "months" mode: which year to show (all months of that year)
    // For "years" mode: ignored (shows all years)
    // For "all" mode: ignored
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()
    if (!membership) return null

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
      .order("asc")
      .collect()

    if (allExpenses.length === 0) return { buckets: [], expenses: [] }

    // Categorise each expense
    const VARIABLE_TYPES = ["fuel", "car_wash", "other", "expense", "tires"]

    function getBucketKey(date: number, mode: string): string {
      const d = new Date(date)
      if (mode === "months") {
        // "2026-04" format
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      }
      // years or all → group by year
      return `${d.getFullYear()}`
    }

    // Filter to relevant year for "months" mode
    const filtered =
      args.mode === "months" && args.year !== undefined
        ? allExpenses.filter((e) => new Date(e.date).getFullYear() === args.year)
        : allExpenses

    // Build buckets map
    const bucketMap = new Map<
      string,
      { fuel: number; variable: number; fixed: number; total: number }
    >()

    for (const e of filtered) {
      const key = getBucketKey(e.date, args.mode)
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { fuel: 0, variable: 0, fixed: 0, total: 0 })
      }
      const b = bucketMap.get(key)!
      b.total += e.amountCzk
      if (e.type === "fuel") b.fuel += e.amountCzk
      if (VARIABLE_TYPES.includes(e.type)) b.variable += e.amountCzk
      else b.fixed += e.amountCzk
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, vals]) => ({ key, ...vals }))

    return { buckets, expenses: filtered }
  },
})

export const listNeedsReviewFuel = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()
    if (!membership) return []

    // Load dismissed fuel tasks
    const dismissed = await ctx.db
      .query("dismissedTasks")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()
    const dismissedFuelKeys = new Set(
      dismissed.filter((d) => d.type === "fuel").map((d) => d.dueKey)
    )

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle_type", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("type", "fuel")
      )
      .order("desc")
      .collect()

    return expenses
      .filter((e) => e.needsReview === true && !dismissedFuelKeys.has(e._id))
  },
})

// Row shape accepted for bulk import (all optional except date, type, amountCzk)
export const bulkImportExpenses = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    rows: v.array(v.object({
      date: v.number(),           // timestamp ms
      type: v.string(),
      amountCzk: v.number(),
      fuelSubtype: v.optional(v.string()),
      liters: v.optional(v.number()),
      pricePerLiter: v.optional(v.number()),
      odometerKmTotal: v.optional(v.number()),
      note: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    await assertMember(ctx, args.vehicleId, userId)

    // Load all existing expenses for duplicate detection
    const existing = await ctx.db
      .query("expenses")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()

    // Build dedup keys: "date|type|amountCzk" + for fuel also "|odometerKmTotal"
    const existingKeys = new Set(
      existing.map((e) => {
        const base = `${e.date}|${e.type}|${e.amountCzk}`
        return e.type === "fuel" && e.odometerKmTotal != null
          ? `${base}|${e.odometerKmTotal}`
          : base
      })
    )

    let imported = 0
    let skipped = 0

    // Sort rows by date ascending so fuel distance/consumption is computed correctly
    const sorted = [...args.rows].sort((a, b) => a.date - b.date)

    for (const row of sorted) {
      const base = `${row.date}|${row.type}|${row.amountCzk}`
      const key = row.type === "fuel" && row.odometerKmTotal != null
        ? `${base}|${row.odometerKmTotal}`
        : base

      if (existingKeys.has(key)) {
        skipped++
        continue
      }

      const validTypes = ["fuel", "car_wash", "service", "tires", "insurance", "installment", "other", "expense"]
      const type = validTypes.includes(row.type) ? row.type as any : "expense"

      if (type === "fuel" && row.odometerKmTotal != null && row.liters != null) {
        // Recompute distance and consumption from already-inserted rows
        const prevFuel = await ctx.db
          .query("expenses")
          .withIndex("by_vehicle_date", (q) => q.eq("vehicleId", args.vehicleId))
          .order("desc")
          .filter((q) => q.eq(q.field("type"), "fuel"))
          .take(20)

        const prev = prevFuel.find(
          (e) => e.date <= row.date && e.odometerKmTotal != null
        )

        let distanceKm: number | undefined
        let consumptionLPer100: number | undefined
        let needsReview = false

        if (prev?.odometerKmTotal != null) {
          distanceKm = row.odometerKmTotal - prev.odometerKmTotal
          if (distanceKm <= 0 || distanceKm > 5000) {
            needsReview = true
            distanceKm = undefined
          } else {
            consumptionLPer100 = parseFloat((row.liters / (distanceKm / 100)).toFixed(2))
            if (consumptionLPer100 > 50 || consumptionLPer100 < 2) needsReview = true
          }
        }

        const amountCzk = row.amountCzk > 0
          ? row.amountCzk
          : parseFloat((row.liters * (row.pricePerLiter ?? 0)).toFixed(2))

        const validSubtypes = ["benzin", "nafta", "elektrina"]
        const fuelSubtype = row.fuelSubtype && validSubtypes.includes(row.fuelSubtype)
          ? (row.fuelSubtype as "benzin" | "nafta" | "elektrina")
          : undefined

        await ctx.db.insert("expenses", {
          vehicleId: args.vehicleId,
          type: "fuel",
          date: row.date,
          amountCzk,
          fuelSubtype,
          liters: row.liters,
          pricePerLiter: row.pricePerLiter,
          odometerKmTotal: row.odometerKmTotal,
          distanceKm,
          consumptionLPer100,
          needsReview,
          note: row.note,
          createdBy: userId,
        })
      } else {
        await ctx.db.insert("expenses", {
          vehicleId: args.vehicleId,
          type,
          date: row.date,
          amountCzk: row.amountCzk,
          note: row.note,
          createdBy: userId,
        })
      }

      existingKeys.add(key)
      imported++
    }

    return { imported, skipped }
  },
})
