import { toast } from 'sonner';

/** 답변 등록 직후 부른다. 답변은 이미 저장됐으니 우편만 실패하면 경고로 알린다. */
export async function sendInquiryAnswerMail(inquiryId: string): Promise<void> {
  try {
    const r = await fetch('/api/admin/notify-inquiry-answered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryId }),
    });
    if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? '');
  } catch (e) {
    toast.warning(`답변은 등록됐지만 우편 발송에 실패했습니다. ${(e as Error).message}`.trim());
  }
}
