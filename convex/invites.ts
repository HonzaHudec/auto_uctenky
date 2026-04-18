import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const createInvite = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    role: v.optional(v.union(v.literal("owner"), v.literal("driver"))),
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
      throw new Error("Only owners can create invites")
    }

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days

    return await ctx.db.insert("invites", {
      vehicleId: args.vehicleId,
      role: args.role ?? "driver",
      createdBy: userId,
      expiresAt,
      maxUses: 10,
      uses: 0,
    })
  },
})

export const getInvite = query({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) return null

    const vehicle = await ctx.db.get(invite.vehicleId)
    const creator = await ctx.db.get(invite.createdBy)

    return {
      ...invite,
      vehicleName: vehicle?.name ?? "Unknown",
      creatorName: creator?.name ?? creator?.email ?? "Someone",
      isExpired: invite.expiresAt < Date.now(),
      isRevoked: !!invite.revokedAt,
      isFull: invite.uses >= invite.maxUses,
    }
  },
})

export const acceptInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw new Error("Invite not found")
    if (invite.revokedAt) throw new Error("This invite has been revoked")
    if (invite.expiresAt < Date.now()) throw new Error("This invite has expired")
    if (invite.uses >= invite.maxUses) throw new Error("This invite has no more uses")

    const existing = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", invite.vehicleId).eq("userId", userId)
      )
      .unique()

    if (existing) {
      return invite.vehicleId
    }

    await ctx.db.insert("vehicleMembers", {
      vehicleId: invite.vehicleId,
      userId,
      role: invite.role,
      addedBy: invite.createdBy,
    })

    await ctx.db.patch(args.inviteId, { uses: invite.uses + 1 })

    return invite.vehicleId
  },
})

export const listInvites = query({
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

    if (!membership || membership.role !== "owner") return []

    const now = Date.now()
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()

    return invites.filter((i) => !i.revokedAt && i.expiresAt > now)
  },
})

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw new Error("Invite not found")

    const membership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", invite.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!membership || membership.role !== "owner") {
      throw new Error("Not authorized")
    }

    await ctx.db.patch(args.inviteId, { revokedAt: Date.now() })
  },
})
