import type { SkinTheme } from '@/lib/skins/registry';
import styles from './game-panel-skin.module.css';

/** CSS 테마를 포털로 이동한 패널에도 명시적으로 전달한다. 기본 스킨은 그대로 둔다. */
export function gamePanelSkinClass(skin?: SkinTheme | null, sheet = false) {
  return skin ? `${styles.theme} ${styles[skin]} ${sheet ? styles.sheet : ''}` : undefined;
}
