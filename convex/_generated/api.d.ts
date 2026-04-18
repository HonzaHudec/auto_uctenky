/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as expenses from "../expenses.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as members from "../members.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notifications from "../notifications.js";
import type * as receipts from "../receipts.js";
import type * as scheduled from "../scheduled.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";
import type * as vignettes from "../vignettes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  auth: typeof auth;
  crons: typeof crons;
  expenses: typeof expenses;
  http: typeof http;
  invites: typeof invites;
  members: typeof members;
  notificationHelpers: typeof notificationHelpers;
  notifications: typeof notifications;
  receipts: typeof receipts;
  scheduled: typeof scheduled;
  users: typeof users;
  vehicles: typeof vehicles;
  vignettes: typeof vignettes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
