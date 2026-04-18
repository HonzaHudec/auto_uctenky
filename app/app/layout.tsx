"use client"

import { Unauthenticated } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Unauthenticated>
        <RedirectToHome />
      </Unauthenticated>
      {children}
    </>
  )
}

function RedirectToHome() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/")
  }, [router])
  return null
}
