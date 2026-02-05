 import { CreditCard } from 'lucide-react';
 import { GymPricing } from '@/contexts/GymContext';
 
 interface GymPricingDisplayProps {
   pricing: GymPricing | null;
 }
 
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
 
   // Extract unique group names for table headers
   const groups = pricing.single_entries.length > 0 
     ? pricing.single_entries[0].prices.map(p => p.group)
     : pricing.memberships.length > 0
       ? pricing.memberships[0].prices.map(p => p.group)
       : [];
 
   const formatPrice = (price: number | null) => {
     if (price === null) return '—';
     return `${price.toLocaleString('cs-CZ')} Kč`;
   };
 
   const renderTable = (title: string, items: typeof pricing.single_entries) => {
     if (items.length === 0) return null;
     
     return (
       <div className="space-y-2">
         <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
           {title}
         </h5>
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="border-b border-border">
                 <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Typ</th>
                 {groups.map(group => (
                   <th key={group} className="text-right py-2 pl-2 font-medium text-muted-foreground whitespace-nowrap">
                     {group}
                   </th>
                 ))}
               </tr>
             </thead>
             <tbody>
               {items.map((item, index) => (
                 <tr key={index} className="border-b border-border/50 last:border-0">
                   <td className="py-2.5 pr-2 font-medium">{item.name}</td>
                   {item.prices.map((priceVariant, priceIndex) => (
                     <td key={priceIndex} className="py-2.5 pl-2 text-right whitespace-nowrap">
                       {formatPrice(priceVariant.price)}
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
 
   return (
     <div className="space-y-6">
       {renderTable('Jednorázové vstupy', pricing.single_entries)}
       {renderTable('Permanentky / Členství', pricing.memberships)}
     </div>
   );
 };
 
 export default GymPricingDisplay;