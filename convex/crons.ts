import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Run daily at 8:00 AM UTC to check for upcoming reminders and send emails
crons.cron(
  "daily notification check",
  "0 8 * * *",
  internal.notifications.sendDueNotifications,
  {}
)

export default crons
