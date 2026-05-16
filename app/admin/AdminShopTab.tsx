import AdminShopItems from './AdminShopItems';
import AdminShopCdpTools from './AdminShopCdpTools';
import AdminShopConsumablesTools from './AdminShopConsumablesTools';
import AdminShopLogsTab from './AdminShopLogsTab';
import AdminShopSubTabs from './AdminShopSubTabs';

interface Props {
  subTab?: string;
  shopLogsPage?: string;
}

type Active = 'items' | 'cdp' | 'consumables' | 'logs';

export default async function AdminShopTab({ subTab, shopLogsPage }: Props) {
  let active: Active = 'items';
  if (subTab === 'cdp') active = 'cdp';
  else if (subTab === 'consumables') active = 'consumables';
  else if (subTab === 'logs') active = 'logs';

  return (
    <div className="flex flex-col gap-4">
      <AdminShopSubTabs current={active} />
      <section>
        {active === 'items' && <AdminShopItems />}
        {active === 'cdp' && <AdminShopCdpTools />}
        {active === 'consumables' && <AdminShopConsumablesTools />}
        {active === 'logs' && <AdminShopLogsTab page={shopLogsPage} />}
      </section>
    </div>
  );
}
