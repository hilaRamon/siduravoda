import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Wired up by AppAlertHost so callers can `await showAlert(...)`. */
let openAlert = null;

/**
 * Site-styled modal alert.
 * - X / overlay → only closes the dialog
 * - אישור → closes; runs onConfirm if provided
 * - ביטול → closes; runs onCancel if provided
 */
export async function showAlert(message, options = {}) {
  if (!openAlert) {
    window.alert(message);
    return;
  }
  return openAlert(message, options);
}

export function AppAlertHost() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("שים לב");
  const [message, setMessage] = useState("");
  const onConfirmRef = useRef(null);
  const onCancelRef = useRef(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    openAlert = (msg, options = {}) => {
      setTitle(options.title ?? "שים לב");
      setMessage(String(msg ?? ""));
      onConfirmRef.current = options.onConfirm ?? null;
      onCancelRef.current = options.onCancel ?? null;
      setOpen(true);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    };

    return () => {
      openAlert = null;
    };
  }, []);

  function finish() {
    if (!resolveRef.current) return;
    const resolve = resolveRef.current;
    resolveRef.current = null;
    onConfirmRef.current = null;
    onCancelRef.current = null;
    setOpen(false);
    setMessage("");
    resolve();
  }

  function handleClose() {
    finish();
  }

  function handleConfirm() {
    onConfirmRef.current?.();
    finish();
  }

  function handleCancel() {
    onCancelRef.current?.();
    finish();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-w-sm rounded-2xl border-border bg-card p-6 shadow-lg sm:rounded-2xl [&>button]:left-4 [&>button]:right-auto"
      >
        <DialogHeader className="space-y-2 text-right sm:text-right">
          <DialogTitle className="text-lg font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-row justify-start gap-2 sm:justify-start">
          <Button className="rounded-xl px-6" onClick={handleConfirm}>
            אישור
          </Button>
          <Button
            variant="outline"
            className="rounded-xl px-6"
            onClick={handleCancel}
          >
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
