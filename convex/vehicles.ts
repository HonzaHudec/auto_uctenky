import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const listMyVehicles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const memberships = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    const vehicles = await Promise.all(
      memberships.map(async (m) => {
        const vehicle = await ctx.db.get(m.vehicleId)
        return vehicle ? { ...vehicle, role: m.role } : null
      })
    )

    return vehicles.filter(Boolean)
  },
})

export const getVehicle = query({
  args: { vehicleId: v.id("vehicles") },
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

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) return null

    return { ...vehicle, role: membership.role }
  },
})

export const createVehicle = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const vehicleId = await ctx.db.insert("vehicles", {
      name: args.name.trim(),
      createdBy: userId,
      currency: "CZK",
    })

    await ctx.db.insert("vehicleMembers", {
      vehicleId,
      userId,
      role: "owner",
      addedBy: userId,
    })

    return vehicleId
  },
})

export const updateVehicleDetails = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    // Basic info
    spz: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    yearManufactured: v.optional(v.number()),
    vin: v.optional(v.string()),
    color: v.optional(v.string()),
    fuelType: v.optional(v.union(
      v.literal("benzin"),
      v.literal("diesel"),
      v.literal("hybrid"),
      v.literal("elektro"),
      v.literal("lpg"),
      v.literal("other"),
    )),
    supportedFuelTypes: v.optional(v.array(v.union(
      v.literal("benzin"),
      v.literal("nafta"),
      v.literal("elektrina"),
    ))),
    defaultFuelType: v.optional(v.union(
      v.literal("benzin"),
      v.literal("nafta"),
      v.literal("elektrina"),
    )),
    engineCcm: v.optional(v.number()),
    powerKw: v.optional(v.number()),
    tankCapacityL: v.optional(v.number()),
    batteryCapacityKwh: v.optional(v.number()),
    firstRegistrationDate: v.optional(v.number()),
    // Reminders
    stkDate: v.optional(v.number()),
    insuranceExpiryDate: v.optional(v.number()),
    serviceKmInterval: v.optional(v.number()),
    serviceLastKm: v.optional(v.number()),
    serviceLastDate: v.optional(v.number()),
    tiresSpringMonth: v.optional(v.number()),
    tiresAutumnMonth: v.optional(v.number()),
    // Notification lead times
    notifyStkDays: v.optional(v.number()),
    notifyInsuranceDays: v.optional(v.number()),
    notifyServiceDays: v.optional(v.number()),
    notifyTiresDays: v.optional(v.number()),
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

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can update vehicle details")
    }

    const { vehicleId, ...patch } = args
    // Remove undefined values from patch
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    )

    await ctx.db.patch(vehicleId, cleanPatch)
  },
})

// Returns upcoming reminders for a vehicle within their notification window
export const getUpcomingReminders = query({
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

    const vehicle = await ctx.db.get(args.vehicleId)
    if (!vehicle) return []

    const now = Date.now()

    // Helper: days until a timestamp
    function daysUntil(ts: number) {
      return Math.ceil((ts - now) / (1000 * 60 * 60 * 24))
    }

    // Helper: next occurrence of a given calendar month
    function nextMonthDate(month: number): number {
      const d = new Date()
      const candidate = new Date(d.getFullYear(), month - 1, 1)
      if (candidate.getTime() <= now) candidate.setFullYear(d.getFullYear() + 1)
      return candidate.getTime()
    }

    // Helper: next STK from registration date
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

    // Load dismissed tasks for this vehicle
    const dismissed = await ctx.db
      .query("dismissedTasks")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()
    const dismissedKeys = new Set(dismissed.map((d) => `${d.type}-${d.dueKey}`))

    const reminders: {
      type: "stk" | "insurance" | "service" | "tires"
      label: string
      daysLeft: number
      dueDate: number
      notifyDays: number
    }[] = []

    // STK
    const stkTs = vehicle.stkDate ?? (vehicle.firstRegistrationDate ? calcNextStk(vehicle.firstRegistrationDate) : undefined)
    if (stkTs) {
      const d = daysUntil(stkTs)
      const notifyDays = vehicle.notifyStkDays ?? 60
      if (d <= notifyDays && !dismissedKeys.has(`stk-${stkTs}`)) {
        reminders.push({ type: "stk", label: "STK", daysLeft: d, dueDate: stkTs, notifyDays })
      }
    }

    // Insurance
    if (vehicle.insuranceExpiryDate) {
      const d = daysUntil(vehicle.insuranceExpiryDate)
      const notifyDays = vehicle.notifyInsuranceDays ?? 60
      if (d <= notifyDays && !dismissedKeys.has(`insurance-${vehicle.insuranceExpiryDate}`)) {
        reminders.push({ type: "insurance", label: "Pojistka", daysLeft: d, dueDate: vehicle.insuranceExpiryDate, notifyDays })
      }
    }

    // Service (date-based only — km-based is harder to determine "days until")
    if (vehicle.serviceLastDate) {
      const notifyDays = vehicle.notifyServiceDays ?? 60
      const nextServiceTs = vehicle.serviceLastDate + 365 * 24 * 60 * 60 * 1000
      const d = daysUntil(nextServiceTs)
      if (d <= notifyDays && !dismissedKeys.has(`service-${nextServiceTs}`)) {
        reminders.push({ type: "service", label: "Servis", daysLeft: d, dueDate: nextServiceTs, notifyDays })
      }
    }

    // Tires
    const springMonth = vehicle.tiresSpringMonth ?? 4
    const autumnMonth = vehicle.tiresAutumnMonth ?? 10
    const nextSpringTs = nextMonthDate(springMonth)
    const nextAutumnTs = nextMonthDate(autumnMonth)
    const nextTiresTs = nextSpringTs < nextAutumnTs ? nextSpringTs : nextAutumnTs
    const tiresLabel = nextSpringTs < nextAutumnTs ? "Přezutí na letní" : "Přezutí na zimní"
    const dTires = daysUntil(nextTiresTs)
    const notifyTiresDays = vehicle.notifyTiresDays ?? 30
    if (dTires <= notifyTiresDays && !dismissedKeys.has(`tires-${nextTiresTs}`)) {
      reminders.push({ type: "tires", label: tiresLabel, daysLeft: dTires, dueDate: nextTiresTs, notifyDays: notifyTiresDays })
    }

    return reminders
  },
})

export const dismissTask = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    type: v.string(),
    dueKey: v.string(),
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
    if (!membership) throw new Error("Not a member")

    // Avoid duplicate dismissals
    const existing = await ctx.db
      .query("dismissedTasks")
      .withIndex("by_vehicle_type_key", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("type", args.type).eq("dueKey", args.dueKey)
      )
      .unique()
    if (!existing) {
      await ctx.db.insert("dismissedTasks", {
        vehicleId: args.vehicleId,
        type: args.type,
        dueKey: args.dueKey,
        dismissedAt: Date.now(),
      })
    }
  },
})

export const listDismissedTasks = query({
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

    return ctx.db
      .query("dismissedTasks")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .collect()
  },
})

export const restoreTask = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    type: v.string(),
    dueKey: v.string(),
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
    if (!membership) throw new Error("Not a member")

    const existing = await ctx.db
      .query("dismissedTasks")
      .withIndex("by_vehicle_type_key", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("type", args.type).eq("dueKey", args.dueKey)
      )
      .unique()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})

export const deleteVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can delete vehicles")
    }

    await ctx.db.delete(args.vehicleId)
  },
})
