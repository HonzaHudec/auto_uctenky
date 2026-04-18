import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  vehicles: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    currency: v.string(),
    // Vehicle details
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
    // Multi-fuel support: which fuels does this vehicle use
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
    batteryCapacityKwh: v.optional(v.number()),     // for hybrid/elektro vehicles
    firstRegistrationDate: v.optional(v.number()), // timestamp, used for STK calc
    // Reminders
    stkDate: v.optional(v.number()),          // next STK date (timestamp)
    insuranceExpiryDate: v.optional(v.number()), // insurance expiry (timestamp)
    serviceKmInterval: v.optional(v.number()), // e.g. 15000 km
    serviceLastKm: v.optional(v.number()),
    serviceLastDate: v.optional(v.number()),
    tiresSpringMonth: v.optional(v.number()), // default 4 (April)
    tiresAutumnMonth: v.optional(v.number()), // default 10 (October)
    // Notification lead times in days (how many days before due to send email)
    notifyStkDays: v.optional(v.number()),        // default 60
    notifyInsuranceDays: v.optional(v.number()),  // default 60
    notifyServiceDays: v.optional(v.number()),    // default 60
    notifyTiresDays: v.optional(v.number()),      // default 30
  }).index("by_creator", ["createdBy"]),

  vignettes: defineTable({
    vehicleId: v.id("vehicles"),
    country: v.string(),                   // ISO 3166-1 alpha-2: "CZ", "SK", "AT"…
    type: v.union(
      v.literal("1_day"),
      v.literal("10_day"),
      v.literal("30_day"),
      v.literal("365_day"),
    ),
    validFrom: v.number(),                 // timestamp (start of day)
    validUntil: v.number(),                // timestamp (end of day = validFrom + N days - 1ms)
    licensePlate: v.string(),              // SPZ (copy from vehicle for quick access)
    purchaseUrl: v.optional(v.string()),   // e.g. https://edalnice.cz/...
    status: v.union(
      v.literal("active"),
      v.literal("expiring_soon"),
      v.literal("expired"),
    ),
    createdBy: v.id("users"),
    note: v.optional(v.string()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_vehicle_country", ["vehicleId", "country"]),

  // Track notifications already sent to avoid duplicates
  sentNotifications: defineTable({
    vehicleId: v.id("vehicles"),
    type: v.union(
      v.literal("stk"),
      v.literal("insurance"),
      v.literal("service"),
      v.literal("tires"),
      v.literal("vignette"),
    ),
    sentAt: v.number(),   // timestamp
    dueDate: v.number(),  // the event due date (for dedup)
    vignetteId: v.optional(v.id("vignettes")), // for vignette notifications
  })
    .index("by_vehicle_type", ["vehicleId", "type"])
    .index("by_vehicle_type_due", ["vehicleId", "type", "dueDate"]),

  vehicleMembers: defineTable({
    vehicleId: v.id("vehicles"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("driver")),
    addedBy: v.id("users"),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_user", ["userId"])
    .index("by_vehicle_user", ["vehicleId", "userId"]),

  expenses: defineTable({
    vehicleId: v.id("vehicles"),
    type: v.union(
      v.literal("fuel"),
      v.literal("car_wash"),
      v.literal("service"),
      v.literal("tires"),
      v.literal("insurance"),
      v.literal("installment"),
      v.literal("other"),
      v.literal("expense"), // new general expense type
    ),
    date: v.number(),
    amountCzk: v.number(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    // Fuel-specific fields
    fuelSubtype: v.optional(v.union(
      v.literal("benzin"),
      v.literal("nafta"),
      v.literal("elektrina"),
    )),
    liters: v.optional(v.number()),       // quantity: litres for benzin/nafta, kWh for elektrina
    pricePerLiter: v.optional(v.number()), // price per unit (Kč/l or Kč/kWh)
    odometerKmTotal: v.optional(v.number()),
    distanceKm: v.optional(v.number()),
    consumptionLPer100: v.optional(v.number()),
    needsReview: v.optional(v.boolean()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_vehicle_date", ["vehicleId", "date"])
    .index("by_vehicle_type", ["vehicleId", "type"]),

  receipts: defineTable({
    vehicleId: v.id("vehicles"),
    expenseId: v.optional(v.id("expenses")),
    storageId: v.id("_storage"),
    deleteAfter: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_expense", ["expenseId"])
    .index("by_delete_after", ["deleteAfter"]),

  // Dismissed tasks (reminders acknowledged by user, or fuel reviews cleared)
  dismissedTasks: defineTable({
    vehicleId: v.id("vehicles"),
    type: v.string(), // "stk", "insurance", "service", "tires", "fuel"
    dueKey: v.string(), // e.g. "1714521600000" (dueDate ts) or expenseId for fuel
    dismissedAt: v.number(),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_vehicle_type_key", ["vehicleId", "type", "dueKey"]),

  invites: defineTable({
    vehicleId: v.id("vehicles"),
    role: v.union(v.literal("owner"), v.literal("driver")),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    maxUses: v.number(),
    uses: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_vehicle", ["vehicleId"]),
})
