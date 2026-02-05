 import { useState, useEffect, useCallback } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Separator } from '@/components/ui/separator';
 import { Plus, Trash2, Loader2 } from 'lucide-react';
 import { GymPricing, PricingItem } from '@/contexts/GymContext';
 
 interface GymPricingEditorProps {
   pricing: GymPricing | null;
   onSave?: (pricing: GymPricing) => Promise<void>;
   onChange?: (pricing: GymPricing) => void;
   showSaveButton?: boolean;
 }
 
 const DEFAULT_GROUPS = ['Základní', 'Studenti a senioři'];
 
 const createEmptyItem = (groups: string[]): PricingItem => ({
   name: '',
   prices: groups.map(group => ({ group, price: null })),
 });
 
 const GymPricingEditor = ({ pricing, onSave, onChange, showSaveButton = true }: GymPricingEditorProps) => {
   const [groups, setGroups] = useState<string[]>(DEFAULT_GROUPS);
   const [singleEntries, setSingleEntries] = useState<PricingItem[]>([]);
   const [memberships, setMemberships] = useState<PricingItem[]>([]);
   const [isSaving, setIsSaving] = useState(false);
 
   useEffect(() => {
     if (pricing) {
       // Extract unique groups from existing pricing
       const existingGroups = new Set<string>();
       [...(pricing.single_entries || []), ...(pricing.memberships || [])].forEach(item => {
         item.prices.forEach(p => existingGroups.add(p.group));
       });
       if (existingGroups.size > 0) {
         setGroups(Array.from(existingGroups));
       }
       setSingleEntries(pricing.single_entries || []);
       setMemberships(pricing.memberships || []);
     } else {
       setSingleEntries([createEmptyItem(DEFAULT_GROUPS)]);
       setMemberships([createEmptyItem(DEFAULT_GROUPS)]);
     }
   }, [pricing]);
 
   // Notify parent of changes
   const notifyChange = useCallback((newSingleEntries: PricingItem[], newMemberships: PricingItem[]) => {
     if (onChange) {
       const cleanedPricing: GymPricing = {
         single_entries: newSingleEntries.filter(item => item.name.trim() !== ''),
         memberships: newMemberships.filter(item => item.name.trim() !== ''),
       };
       onChange(cleanedPricing);
     }
   }, [onChange]);
 
   const handleAddItem = (section: 'single' | 'membership') => {
     const newItem = createEmptyItem(groups);
     if (section === 'single') {
       const updated = [...singleEntries, newItem];
       setSingleEntries(updated);
       notifyChange(updated, memberships);
     } else {
       const updated = [...memberships, newItem];
       setMemberships(updated);
       notifyChange(singleEntries, updated);
     }
   };
 
   const handleRemoveItem = (section: 'single' | 'membership', index: number) => {
     if (section === 'single') {
       const updated = singleEntries.filter((_, i) => i !== index);
       setSingleEntries(updated);
       notifyChange(updated, memberships);
     } else {
       const updated = memberships.filter((_, i) => i !== index);
       setMemberships(updated);
       notifyChange(singleEntries, updated);
     }
   };
 
   const handleUpdateItemName = (section: 'single' | 'membership', index: number, name: string) => {
     if (section === 'single') {
       const updated = [...singleEntries];
       updated[index] = { ...updated[index], name };
       setSingleEntries(updated);
       notifyChange(updated, memberships);
     } else {
       const updated = [...memberships];
       updated[index] = { ...updated[index], name };
       setMemberships(updated);
       notifyChange(singleEntries, updated);
     }
   };
 
   const handleUpdatePrice = (section: 'single' | 'membership', itemIndex: number, groupIndex: number, value: string) => {
     const price = value === '' ? null : Number(value);
     if (section === 'single') {
       const updated = [...singleEntries];
       updated[itemIndex] = {
         ...updated[itemIndex],
         prices: updated[itemIndex].prices.map((p, i) => 
           i === groupIndex ? { ...p, price } : p
         ),
       };
       setSingleEntries(updated);
       notifyChange(updated, memberships);
     } else {
       const updated = [...memberships];
       updated[itemIndex] = {
         ...updated[itemIndex],
         prices: updated[itemIndex].prices.map((p, i) => 
           i === groupIndex ? { ...p, price } : p
         ),
       };
       setMemberships(updated);
       notifyChange(singleEntries, updated);
     }
   };
 
   const handleSave = async () => {
     if (!onSave) return;
     setIsSaving(true);
     try {
       // Filter out items without names
       const cleanedPricing: GymPricing = {
         single_entries: singleEntries.filter(item => item.name.trim() !== ''),
         memberships: memberships.filter(item => item.name.trim() !== ''),
       };
       await onSave(cleanedPricing);
     } finally {
       setIsSaving(false);
     }
   };
 
   const renderPricingSection = (
     title: string, 
     items: PricingItem[], 
     section: 'single' | 'membership'
   ) => (
     <Card>
       <CardHeader className="pb-2">
         <CardTitle className="text-base">{title}</CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         {items.length === 0 && (
           <p className="text-sm text-muted-foreground text-center py-2">
             Zatím žádné položky
           </p>
         )}
         {items.map((item, itemIndex) => (
           <div key={itemIndex} className="space-y-3 p-3 bg-muted/30 rounded-lg">
             <div className="flex items-center gap-2">
               <Input
                 placeholder="Název položky (např. Po-Pá do 14:00)"
                 value={item.name}
                 onChange={(e) => handleUpdateItemName(section, itemIndex, e.target.value)}
                 className="flex-1"
               />
               <Button
                 type="button"
                 variant="ghost"
                 size="icon"
                 className="text-destructive hover:text-destructive"
                 onClick={() => handleRemoveItem(section, itemIndex)}
               >
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {groups.map((group, groupIndex) => (
                 <div key={group} className="space-y-1">
                   <Label className="text-xs text-muted-foreground">{group}</Label>
                   <div className="relative">
                     <Input
                       type="number"
                       placeholder="—"
                       value={item.prices[groupIndex]?.price ?? ''}
                       onChange={(e) => handleUpdatePrice(section, itemIndex, groupIndex, e.target.value)}
                       className="pr-8"
                     />
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                       Kč
                     </span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         ))}
         <Button
           type="button"
           variant="outline"
           className="w-full"
           onClick={() => handleAddItem(section)}
         >
           <Plus className="w-4 h-4 mr-2" />
           Přidat položku
         </Button>
       </CardContent>
     </Card>
   );
 
   return (
     <div className="space-y-6">
       {renderPricingSection('Jednorázové vstupy', singleEntries, 'single')}
       {renderPricingSection('Permanentky / Členství', memberships, 'membership')}
       
       {showSaveButton && onSave && (
         <>
           <Separator />
           <Button 
             className="w-full" 
             onClick={handleSave}
             disabled={isSaving}
           >
             {isSaving ? (
               <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Ukládám...
               </>
             ) : (
               'Uložit ceník'
             )}
           </Button>
         </>
       )}
     </div>
   );
 };
 
 export default GymPricingEditor;