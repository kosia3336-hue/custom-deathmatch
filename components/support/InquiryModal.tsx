'use client';

import { Modal } from '@/components/cdm/Modal';
import InquiryForm from '@/app/support/inquiry/InquiryForm';

/**
 * 문의 보내기 모달 — 모바일 메뉴의 '문의하기' 가 보던 화면을 떠나지 않고 띄운다.
 * 로그인 회원 전용(비회원은 /support/inquiry 페이지 → 로그인으로 보낸다).
 * 닫았다 열면 입력을 새로 시작하도록 열려 있을 때만 폼을 그린다.
 */
export default function InquiryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="문의 보내기" size="lg">
      <p className="mb-4 text-sm text-cdm-fg-muted">
        서비스 이용 중 문의 사항을 보내주세요. 최대한 빠른 시일 내로 답변드립니다.
      </p>
      {open && <InquiryForm reasonTag={null} onSubmitted={onClose} />}
    </Modal>
  );
}
