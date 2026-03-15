import type { InputHTMLAttributes } from 'react';

export function Switch(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className="h-5 w-10 rounded-full accent-primary" {...props} />;
}
