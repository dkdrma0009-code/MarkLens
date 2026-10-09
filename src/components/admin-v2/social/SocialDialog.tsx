"use client"
import type { ReactNode, RefObject } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"

export default function SocialDialog({ open, onClose, title, description, children, returnFocus, busy = false, label = "SOCIAL OPERATION" }: {
  open: boolean; onClose: () => void; title: string; description: string; children: ReactNode
  returnFocus: RefObject<HTMLElement | null>; busy?: boolean; label?: string
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value && !busy) onClose() }}>
    <Dialog.Portal><Dialog.Backdrop className="admin-confirm-backdrop" /><Dialog.Popup className="admin-confirm social-dialog" finalFocus={returnFocus}>
      <div className="admin-confirm-heading"><span>{label}</span><Dialog.Close disabled={busy} aria-label="확인 창 닫기"><X size={18} /></Dialog.Close></div>
      <Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>{children}
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>
}
