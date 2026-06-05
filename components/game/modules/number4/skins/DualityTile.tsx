'use client';

interface DualityTileProps {
  type: 'frost' | 'obsidian';
  size?: 'sm' | 'xs';
}

export function DualityTile({ type, size = 'sm' }: DualityTileProps) {
  return (
    <div
      className={`skin-duality-tile skin-duality-tile--${type} skin-duality-tile--${size}`}
    />
  );
}

interface DualityTileRowProps {
  white: number;
  total: number;
}

export function DualityTileRow({ white, total }: DualityTileRowProps) {
  return (
    <div className="flex justify-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <DualityTile key={i} type={i < white ? 'frost' : 'obsidian'} size="sm" />
      ))}
    </div>
  );
}
