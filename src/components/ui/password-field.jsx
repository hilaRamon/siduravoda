import { useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

function keepEnglishKeyboardChars(value) {
  return value.replace(/[^\x20-\x7E]/g, '');
}

export function PasswordField({
  id,
  value,
  onValueChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
  disabled = false,
  minLength = 6,
  showLengthValidation = false,
}) {
  const inputRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const isTooShort = useMemo(
    () => showLengthValidation && value.length > 0 && value.length < minLength,
    [showLengthValidation, value, minLength],
  );

  function toggleVisible() {
    const el = inputRef.current;
    const start = el?.selectionStart ?? null;
    const end = el?.selectionEnd ?? null;

    setVisible((prev) => !prev);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      if (start !== null && end !== null) {
        try {
          el.setSelectionRange(start, end);
        } catch {
          // ignore if selection cannot be restored
        }
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onValueChange(keepEnglishKeyboardChars(e.target.value))}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          dir="ltr"
          lang="en"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="ps-10"
          style={visible ? undefined : { WebkitTextSecurity: 'disc' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleVisible}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {isTooShort && (
        <p className="text-xs text-muted-foreground">
          הסיסמה חייבת להכיל לפחות {minLength} תווים
        </p>
      )}
    </div>
  );
}
