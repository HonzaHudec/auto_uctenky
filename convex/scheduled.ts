import { internalMutation } from "./_generated/server"
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

export const deleteExpiredReceipts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query("receipts")
      .withIndex("by_delete_after", (q) => q.lt("deleteAfter", now))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(100)

    console.log(`[cron] Deleting ${expired.length} expired receipts`)

    for (const receipt of expired) {
      try {
        await ctx.storage.delete(receipt.storageId)
        await ctx.db.patch(receipt._id, { deletedAt: now })
      } catch (err) {
        console.error(`Failed to delete receipt ${receipt._id}:`, err)
      }
    }
  },
})

const crons = cronJobs()

crons.daily(
  "delete expired receipts",
  { hourUTC: 3, minuteUTC: 0 },
  internal.scheduled.deleteExpiredReceipts
)

export default crons
