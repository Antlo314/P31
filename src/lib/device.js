import { useEffect, useState } from 'react';

// "Phone" here means a narrow screen. Heavy tools (video editing on the device) are kept
// for computers; everything else is laid out for both.
const QUERY = '(max-width: 768px)';

export const isPhone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** True on phone-sized screens, and updates if the window is resized or rotated. */
export function useIsPhone() {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(QUERY);
    const on = () => setPhone(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return phone;
}
