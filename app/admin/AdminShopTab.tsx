import { Tabs } from '@/components/cdm/Tabs';
import AdminShopItems from './AdminShopItems';
import AdminShopCdpTools from './AdminShopCdpTools';
import AdminShopConsumablesTools from './AdminShopConsumablesTools';
import AdminShopSubTabs from './AdminShopSubTabs';

interface Props {
  subTab?: string;
}

type Active = 'items' | 'cdp' | 'consumables';

export default async function AdminShopTab({ subTab }: Props) {
  let active: Active = 'items';
  if (subTab === 'cdp') active = 'cdp';
  else if (subTab === 'consumables') active = 'consumables';
  void Tabs; // 타입 import 보존용 — 실제 탭 UI 는 client 컴포넌트.

  return (
    <div className="flex flex-col gap-4">
      <AdminShopSubTabs current={active} />
      <section>
        {active === 'items' && <AdminShopItems />}
        {active === 'cdp' && <AdminShopCdpTools />}
        {active === 'consumables' && <AdminShopConsumablesTools />}
      </section>
    </div>
  );
}
