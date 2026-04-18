import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")
    return await ctx.storage.generateUploadUrl()
  },
})

export const createReceipt = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    storageId: v.id("_storage"),
    expenseId: v.optional(v.id("expenses")),
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

    const deleteAfter = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

    return await ctx.db.insert("receipts", {
      vehicleId: args.vehicleId,
      storageId: args.storageId,
      expenseId: args.expenseId,
      deleteAfter,
    })
  },
})

export const getReceiptByExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first()

    if (!receipt) return null

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", receipt.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership) return null

    const url = await ctx.storage.getUrl(receipt.storageId)
    return { ...receipt, url }
  },
})

export const linkReceiptToExpense = mutation({
  args: {
    receiptId: v.id("receipts"),
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const receipt = await ctx.db.get(args.receiptId)
    if (!receipt) throw new Error("Receipt not found")

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", receipt.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership) throw new Error("Not authorized")

    await ctx.db.patch(args.receiptId, { expenseId: args.expenseId })
  },
})
