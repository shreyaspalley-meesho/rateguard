export function PhoneFrame({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="phone-frame">
      <div className="phone-statusbar">
        <span>9:41</span>
        <span>{title ?? 'RateGuard'}</span>
        <span>●●●●</span>
      </div>
      <div className="p-4 pb-8 max-h-[720px] overflow-auto">{children}</div>
    </div>
  );
}
