import React, { useRef, useState } from 'react';

// Number input that never captures horizontal pan gestures. iOS WebKit lets a
// focusable <input> own horizontal touch moves (text-cursor drag), which broke
// swipe-to-delete on set rows whenever the swipe started on a field — i.e. most
// of the row. While unfocused the input has pointer-events:none and the wrapper
// forwards the tap to focus() (still a user gesture → keyboard opens); once
// focused it behaves like a normal input until blur.
type Props = React.InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string };

export const GestureSafeInput = ({ containerClassName, className, style, onFocus, onBlur, ...props }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={containerClassName}
      style={{ touchAction: 'pan-y' }}
      onClick={() => { if (!focused) ref.current?.focus(); }}
    >
      <input
        {...props}
        ref={ref}
        className={className}
        style={{ ...style, pointerEvents: focused ? 'auto' : 'none' }}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      />
    </div>
  );
};
