import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Loader2, GitMerge, Package } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MachineWithUsage {
  id: string;
  name: string;
  exerciseCount: number;
  gymCount: number;
}

interface DuplicateGroup {
  name: string;
  items: MachineWithUsage[];
}

interface DuplicateMachinesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: DuplicateGroup[];
  selectedPrimary: Record<string, string>;
  isLoading: boolean;
  isMerging: boolean;
  onSelectPrimary: (groupName: string, machineId: string) => void;
  onMerge: (groupName: string) => void;
}

const DuplicateMachinesDrawer = ({
  open,
  onOpenChange,
  duplicateGroups,
  selectedPrimary,
  isLoading,
  isMerging,
  onSelectPrimary,
  onMerge,
}: DuplicateMachinesDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Duplicitní stroje ({duplicateGroups.length} skupin)
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Žádné duplicity nebyly nalezeny</p>
            </div>
          ) : (
            <div className="space-y-6">
              {duplicateGroups.map((group) => (
                <div 
                  key={group.name} 
                  className="border rounded-lg p-4 bg-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="font-medium">{group.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length} záznamy
                    </Badge>
                  </div>
                  
                  <RadioGroup
                    value={selectedPrimary[group.name] || ''}
                    onValueChange={(value) => onSelectPrimary(group.name, value)}
                    className="space-y-2"
                  >
                    {group.items.map((machine) => (
                      <div
                        key={machine.id}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                          selectedPrimary[group.name] === machine.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border'
                        }`}
                      >
                        <RadioGroupItem value={machine.id} id={machine.id} />
                        <Label 
                          htmlFor={machine.id} 
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {machine.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {machine.id.substring(0, 8)}...
                            </span>
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Cviky: {machine.exerciseCount}</span>
                            <span>Posilovny: {machine.gymCount}</span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  
                  <Button
                    onClick={() => onMerge(group.name)}
                    disabled={isMerging || !selectedPrimary[group.name]}
                    className="w-full mt-4"
                    size="sm"
                  >
                    {isMerging ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <GitMerge className="w-4 h-4 mr-2" />
                    )}
                    Sloučit do vybraného
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Zavřít
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default DuplicateMachinesDrawer;
