import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GymPricing, PricingItem } from '@/contexts/GymContext';

interface GymPricingDisplayProps {
  pricing: GymPricing | null;
}

const formatPrice = (price: number | null) => {
  if (price === null) return '—';
  return `${price.toLocaleString('cs-CZ')} Kč`;
};

const groupByColumns = (items: PricingItem[]) => {
  const sections: { groups: string[]; items: PricingItem[] }[] = [];

  for (const item of items) {
    const key = item.prices.map(p => p.group).join('|');
    const existing = sections.find(s => s.items[0]?.prices.map(p => p.group).join('|') === key);
    if (existing) {
      existing.items.push(item);
    } else {
      sections.push({
        groups: item.prices.map(p => p.group),
        items: [item],
      });
    }
  }

  return sections;
};

const renderSection = (title: string, groups: string[], items: PricingItem[], isEn: boolean) => {
  const showHeader = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Cena');

  return (
    <div key={title} className="space-y-2">
      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h5>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {showHeader && (
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-2 font-medium text-muted-foreground" />
                {items[0]?.prices.map((pv, i) => (
                  <th key={i} className="text-right py-2 pl-2 font-medium text-muted-foreground whitespace-nowrap text-xs">
                    {(isEn && pv.group_en) ? pv.group_en : pv.group}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-2">
                  <div className="font-medium">{(isEn && item.name_en) ? item.name_en : item.name}</div>
                  {(isEn ? (item.description_en || item.description) : item.description) && (
                    <div className="text-xs text-muted-foreground">
                      {isEn ? (item.description_en || item.description) : item.description}
                    </div>
                  )}
                </td>
                {item.prices.map((pv, pi) => (
                  <td key={pi} className="py-2.5 pl-2 text-right whitespace-nowrap font-medium">
                    {formatPrice(pv.price)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GymPricingDisplay = ({ pricing }: GymPricingDisplayProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  if (!pricing || (pricing.single_entries.length === 0 && pricing.memberships.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CreditCard className="w-12 h-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          {t('map.pricing_not_available')}
        </p>
      </div>
    );
  }

  const singleSections = groupByColumns(pricing.single_entries);
  const membershipSections = groupByColumns(pricing.memberships);

  const SECTION_NAMES_SINGLE = [t('map.pricing_single_entry')];
  const SECTION_NAMES_MEMBERSHIP = [
    t('map.pricing_memberships'),
    t('map.pricing_entry_passes'),
    t('map.pricing_solarium'),
    t('map.pricing_other'),
  ];

  return (
    <div className="space-y-6">
      {singleSections.map((section, i) =>
        renderSection(
          SECTION_NAMES_SINGLE[i] || (isEn ? 'Entries' : 'Vstupy'),
          section.groups,
          section.items,
          isEn
        )
      )}
      {membershipSections.map((section, i) =>
        renderSection(
          SECTION_NAMES_MEMBERSHIP[i] || (isEn ? 'Services' : 'Služby'),
          section.groups,
          section.items,
          isEn
        )
      )}
    </div>
  );
};

export default GymPricingDisplay;
