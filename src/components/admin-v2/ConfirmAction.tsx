"use client"

import type { RefObject } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { LoaderCircle, X } from "lucide-react"

export default function ConfirmAction({ open, onOpenChange, title, description, confirmLabel, busy, destructive = false, onConfirm, returnFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  confirmLabel: string; busy: boolean; destructive?: boolean; onConfirm: () => void; returnFocus: RefObject<HTMLElement | null>
}) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
    <Dialog.Portal><Dialog.Backdrop className="admin-confirm-backdrop" />
      <Dialog.Popup className="admin-confirm" finalFocus={returnFocus}>
        <div className="admin-confirm-heading"><span>CONFIRM OPERATION</span><Dialog.Close disabled={busy} aria-label="확인 창 닫기"><X size={18} /></Dialog.Close></div>
        <Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>
        <div className="admin-confirm-buttons"><Dialog.Close className="admin-control" disabled={busy} autoFocus>취소</Dialog.Close>
          <button className={`admin-control ${destructive ? "admin-danger" : "admin-primary"}`} disabled={busy} onClick={onConfirm}>
            {busy ? <><LoaderCircle size={15} className="admin-spin" /> 처리 중…</> : confirmLabel}
          </button></div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
