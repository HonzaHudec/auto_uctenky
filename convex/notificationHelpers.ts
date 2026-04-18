import { internalQuery, internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

export const getAllVehiclesForNotify = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("vehicles").collect()
  },
})

export const getAllVignettesByVehicle = internalQuery({
  args: { vehicleId: v.id("vehicles") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vignettes")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()
  },
})

export const updateVignetteStatus = internalMutation({
  args: {
    vignetteId: v.id("vignettes"),
    status: v.union(v.literal("active"), v.literal("expiring_soon"), v.literal("expired")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vignetteId, { status: args.status })
    return null
  },
})

export const checkAlreadySentVignette = internalQuery({
  args: {
    vehicleId: v.id("vehicles"),
    vignetteId: v.id("vignettes"),
    dueDate: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sent = await ctx.db
      .query("sentNotifications")
      .withIndex("by_vehicle_type_due", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("type", "vignette").eq("dueDate", args.dueDate)
      )
      .filter((q) => q.eq(q.field("vignetteId"), args.vignetteId))
      .first()
    return sent !== null
  },
})

export const recordSentVignette = internalMutation({
  args: {
    vehicleId: v.id("vehicles"),
    vignetteId: v.id("vignettes"),
    dueDate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("sentNotifications", {
      vehicleId: args.vehicleId,
      type: "vignette",
      sentAt: Date.now(),
      dueDate: args.dueDate,
      vignetteId: args.vignetteId,
    })
    return null
  },
})

export const checkAlreadySent = internalQuery({
  args: {
    vehicleId: v.id("vehicles"),
    type: v.union(v.literal("stk"), v.literal("insurance"), v.literal("service"), v.literal("tires"), v.literal("vignette")),
    dueDate: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sent = await ctx.db
      .query("sentNotifications")
      .withIndex("by_vehicle_type_due", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("type", args.type).eq("dueDate", args.dueDate)
      )
      .unique()
    return sent !== null
  },
})

export const recordSent = internalMutation({
  args: {
    vehicleId: v.id("vehicles"),
    type: v.union(v.literal("stk"), v.literal("insurance"), v.literal("service"), v.literal("tires")),
    dueDate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("sentNotifications", {
      vehicleId: args.vehicleId,
      type: args.type,
      sentAt: Date.now(),
      dueDate: args.dueDate,
    })
    return null
  },
})
