import { Loader2, Trash2 } from 'lucide-react';

export function DeleteIconButton({ onClick, disabled, isDeleting, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:pointer-events-none"
      aria-label={ariaLabel}
    >
      {isDeleting ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <Trash2 size={11} />
      )}
    </button>
  );
}
