import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "@convex-dev/auth/server"

export const listMembers = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const myMembership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!myMembership) return []

    const memberships = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect()

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId)
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          name: user?.name,
          email: user?.email,
        }
      })
    )

    return members
  },
})

export const getMyRole = query({
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

    return membership?.role ?? null
  },
})

export const removeMember = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    membershipId: v.id("vehicleMembers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const myMembership = await ctx.db
      .query("vehicleMembers")
      .withIndex("by_vehicle_user", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("userId", userId)
      )
      .unique()

    if (!myMembership || myMembership.role !== "owner") {
      throw new Error("Only owners can remove members")
    }

    const target = await ctx.db.get(args.membershipId)
    if (!target || target.vehicleId !== args.vehicleId) {
      throw new Error("Member not found")
    }

    if (target.userId === userId) {
      throw new Error("You cannot remove yourself")
    }

    await ctx.db.delete(args.membershipId)
  },
})

export const leaveVehicle = mutation({
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

    if (!membership) throw new Error("Not a member")
    if (membership.role === "owner") {
      const allMembers = await ctx.db
        .query("vehicleMembers")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
        .collect()
      const otherOwners = allMembers.filter(
        (m) => m.userId !== userId && m.role === "owner"
      )
      if (otherOwners.length === 0) {
        throw new Error("Transfer ownership before leaving")
      }
    }

    await ctx.db.delete(membership._id)
  },
})
