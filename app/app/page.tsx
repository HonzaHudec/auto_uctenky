"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function AppIndexPage() {
  const vehicles = useQuery(api.vehicles.listMyVehicles)
  const router = useRouter()

  useEffect(() => {
    if (vehicles === undefined) return // still loading
    if (vehicles.length === 0) {
      router.replace("/app/vehicles/new")
    } else {
      const first = vehicles[0]
      if (first) router.replace(`/app/v/${first._id}/dashboard`)
    }
  }, [vehicles, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  )
}
