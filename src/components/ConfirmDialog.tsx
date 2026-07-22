'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  riskWarning: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, description, riskWarning, onConfirm, onCancel }: ConfirmDialogProps) {
  const [checked, setChecked] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">⚠ 高风险品类确认</p>
          <p className="mt-1">{riskWarning}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="confirm-check"
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="confirm-check" className="text-sm text-muted-foreground">
            我已阅读并理解上述风险提示，确认继续
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button disabled={!checked} onClick={onConfirm}>确认并发布</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
