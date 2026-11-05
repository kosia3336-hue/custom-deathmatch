import { cn } from '@/lib/utils';
import styles from './cheongryong-title.module.css';
import { CheongryongDragon } from './CheongryongDragon';

/** 새로 편집한 열린 청룡이 타원형 명패 경로를 따라 움직이고 구름은 따로 흐른다. */
export function CheongryongTitle({
  name,
  sizeClassName,
  className,
}: {
  name: string;
  sizeClassName: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'title-cheongryong inline-flex items-center rounded-full border-[1.5px] leading-none font-semibold whitespace-nowrap',
        sizeClassName,
        styles.badge,
        className,
      )}
    >
      <span className={styles.atmosphere} aria-hidden="true" data-weather-layer="clouds">
        <span className={cn(styles.cloud, styles.cloudLeft)} />
        <span className={cn(styles.cloud, styles.cloudRight)} />
        <span className={cn(styles.cloud, styles.cloudLow)} />
      </span>
      <DragonLayer />
      <span className={styles.label}>{name}</span>
      <span className={styles.haze} aria-hidden="true" data-weather-layer="mist">
        <span className={styles.mist} />
      </span>
    </span>
  );
}

function DragonLayer() {
  return (
    <span className={styles.layer} aria-hidden="true" data-dragon-layer="surround">
      <span className={styles.projection}>
        <CheongryongDragon className={styles.dragon} />
      </span>
    </span>
  );
}
