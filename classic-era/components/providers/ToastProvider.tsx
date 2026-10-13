'use client';

import { Toaster } from 'sonner';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'text-sm',
        duration: 4000,
      }}
      richColors
      closeButton
    />
  );
}
