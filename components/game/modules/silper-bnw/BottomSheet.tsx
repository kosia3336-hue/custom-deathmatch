'use client';

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[85vh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div
          className="overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'max(16px, var(--cdm-safe-bottom, 0px))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
