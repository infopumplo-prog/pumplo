import { CreditCard } from 'lucide-react';
import { GymPricing, PricingItem } from '@/contexts/GymContext';

interface GymPricingDisplayProps {
  pricing: GymPricing | null;
}

const formatPrice = (price: number | null) => {
  if (price === null) return '—';
  return `${price.toLocaleString('cs-CZ')} Kč`;
};

// Group items by their price group structure (same columns = same section)
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

const renderSection = (title: string, groups: string[], items: PricingItem[]) => {
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
                {groups.map(group => (
                  <th key={group} className="text-right py-2 pl-2 font-medium text-muted-foreground whitespace-nowrap text-xs">
                    {group}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pr-2">
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
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
  if (!pricing || (pricing.single_entries.length === 0 && pricing.memberships.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CreditCard className="w-12 h-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          Ceník není k dispozici
        </p>
      </div>
    );
  }

  // Split memberships into logical sections based on column structure
  const singleSections = groupByColumns(pricing.single_entries);
  const membershipSections = groupByColumns(pricing.memberships);

  // Build named sections matching PDF structure
  const SECTION_NAMES_SINGLE = ['Jednorázový vstup'];
  const SECTION_NAMES_MEMBERSHIP = [
    'Permanentky',
    'Vstupové permanentky',
    'Solárium',
    'Ostatní',
  ];

  return (
    <div className="space-y-6">
      {singleSections.map((section, i) =>
        renderSection(
          SECTION_NAMES_SINGLE[i] || 'Vstupy',
          section.groups,
          section.items
        )
      )}
      {membershipSections.map((section, i) =>
        renderSection(
          SECTION_NAMES_MEMBERSHIP[i] || `Služby`,
          section.groups,
          section.items
        )
      )}
    </div>
  );
};

export default GymPricingDisplay;
