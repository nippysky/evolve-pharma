import { getVatSettings } from '@/lib/data/settings.server';
import BasketContent       from './BasketContent';

export default async function BasketPage() {
  const vatSettings = await getVatSettings();
  return <BasketContent vatEnabled={vatSettings.enabled} vatRate={vatSettings.rate} />;
}
