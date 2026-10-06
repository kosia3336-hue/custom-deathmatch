export default function BettingSummary({
  chips,
  pot,
  callCost,
  status,
}: {
  chips: number;
  pot: number;
  callCost: number;
  status: string;
}) {
  return (
    <>
      <div className="ip-betting-summary">
        <span>
          보유 칩 <strong>{chips}</strong>
        </span>
        <span>
          팟 <strong>{pot}</strong>
        </span>
        <span>
          콜 비용 <strong>{Math.max(0, callCost)}</strong>
        </span>
      </div>
      <p className="ip-betting-status" title={status}>
        {status}
      </p>
    </>
  );
}
