'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName } from '@/lib/permissions'
import { Logo } from '@/components/brand/Logo'
import {
  LayoutDashboard,
  Zap,
  Heart,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Phone,
  Target,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workouts', href: '/workouts', icon: Zap },
  { name: 'Calls', href: '/calls', icon: Phone },
  { name: 'Seasons', href: '/seasons', icon: Target },
  { name: 'Impact', href: '/donations', icon: Heart },
  { name: 'Transformation', href: '/transformation', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const tierBadgeColors: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  PRO: 'bg-primary/15 text-primary border border-primary/20',
  ELITE: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  CONCIERGE: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  B2B: 'bg-primary/15 text-primary border border-primary/20',
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <Logo size={36} className="glow-sm group-hover:opacity-90 transition-opacity" />
          <span className="text-xl font-bold tracking-tight text-gradient">Ivy</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary/12 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'w-4.5 h-4.5 flex-shrink-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span>{item.name}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade nudge for trial users */}
      {user?.subscriptionTier === 'FREE' && (
        <div className="mx-3 mb-3">
          <Link href="/pricing">
            <div className="p-3.5 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 hover:border-primary/25 transition-all cursor-pointer group">
              <p className="text-xs font-semibold text-primary mb-0.5">Choose your plan</p>
              <p className="text-xs text-muted-foreground">Ivy from £70/mo · No card needed to start</p>
            </div>
          </Link>
        </div>
      )}

      {/* User section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg mb-1">
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            {user?.subscriptionTier && (
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block',
                tierBadgeColors[user.subscriptionTier]
              )}>
                {getTierName(user.subscriptionTier)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-full bg-card border-r border-border">
        <SidebarContent />
      </div>

      {/* Mobile: hamburger button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 shadow-2xl">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
