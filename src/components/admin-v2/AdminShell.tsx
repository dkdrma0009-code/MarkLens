"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  Activity, ArrowUpRight, BarChart2, CalendarDays, Clapperboard, FileText,
  Image as ImageIcon, Lightbulb, Mail, Menu, MessageSquare, Rss, Users, X,
} from "lucide-react"

const groups = [
  { label: "Overview", items: [{ href: "/admin", label: "Overview", icon: Activity }] },
  { label: "Content", items: [
    { href: "/admin/articles", label: "Articles", icon: FileText },
    { href: "/admin/insights", label: "Insights", icon: Lightbulb },
  ] },
  { label: "Distribution", items: [
    { href: "/admin/cardnews", label: "Social", icon: ImageIcon },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
    { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/admin/adkit", label: "AdKit", icon: Clapperboard },
  ] },
  { label: "Audience", items: [
    { href: "/admin/subscribers", label: "Subscribers", icon: Users },
    { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  ] },
  { label: "Intelligence", items: [
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/admin/sources", label: "Sources", icon: Rss },
    { href: "/admin/insight-lab", label: "Challenges", icon: Lightbulb },
  ] },
]

function activePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

function AdminWordmark({ onNavigate }: { onNavigate?: () => void }) {
  return <Link href="/admin" onClick={onNavigate} className="admin-wordmark" aria-label="MarkLens Admin Overview">
    <span>MarkLens<span className="admin-wordmark-dot">.</span></span>
    <small>ADMIN / CONTROL ROOM</small>
  </Link>
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <>
    <AdminWordmark onNavigate={onNavigate} />
    <nav className="admin-nav" aria-label="관리자 메뉴">
      {groups.map(group => <div className="admin-nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href}
          onClick={onNavigate} aria-current={activePath(pathname, href) ? "page" : undefined}>
          <Icon size={16} aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </div>)}
    </nav>
    <div className="admin-sidebar-footer">
      <Link href="/" onClick={onNavigate}>Public site <ArrowUpRight size={15} aria-hidden="true" /></Link>
      <span>Admin workspace</span>
    </div>
  </>
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = groups.flatMap(group => group.items).find(item => activePath(pathname, item.href))
  const overview = pathname === "/admin"

  return <div className="admin-shell">
    <a className="admin-skip" href="#admin-content">본문으로 이동</a>
    <aside className="admin-sidebar"><Sidebar pathname={pathname} /></aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="admin-menu-button" aria-label="관리자 메뉴 열기"><Menu size={21} /></Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="admin-drawer-backdrop" />
            <Dialog.Popup className="admin-drawer">
              <Dialog.Title className="sr-only">MarkLens 관리자 메뉴</Dialog.Title>
              <Dialog.Description className="sr-only">콘텐츠, 배포, 독자 및 분석 운영 화면으로 이동합니다.</Dialog.Description>
              <Dialog.Close className="admin-drawer-close" aria-label="메뉴 닫기"><X size={20} /></Dialog.Close>
              <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <div className="admin-topbar-title"><span>{overview ? "Operations" : "MarkLens / Admin"}</span>
          <h1>{overview ? "오늘 MarkLens 상태" : current?.label ?? "Content preview"}</h1>
        </div>
        <Link className="admin-public-link" href="/">Public site <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>
      <main id="admin-content" className="admin-main" tabIndex={-1}>{children}</main>
    </div>
  </div>
}
