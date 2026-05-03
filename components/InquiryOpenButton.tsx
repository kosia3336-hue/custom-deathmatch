'use client';

import { useState } from 'react';
import { Button } from '@/components/cdm/Button';
import InquirySubmitModal from '@/components/InquirySubmitModal';

interface Props {
  reasonTag?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export default function InquiryOpenButton({ reasonTag, children, size, fullWidth }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} fullWidth={fullWidth} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <InquirySubmitModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
        reasonTag={reasonTag}
      />
    </>
  );
}
