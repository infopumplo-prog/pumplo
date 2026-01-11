import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminLayout from "./AdminLayout";
import { Upload, CheckCircle2 } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  description: string | null;
  target_muscles: string[];
  equipment_type: string;
  image_url: string | null;
}

// Parse CSV with semicolon delimiter and handle quoted fields with escaped quotes
function parseCSV(text: string): Machine[] {
  const lines = text.trim().split('\n');
  const machines: Machine[] = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse semicolon-separated values, handling quoted fields with escaped quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      
      if (char === '"' && nextChar === '"') {
        // Escaped quote inside quoted field
        current += '"';
        j++; // Skip next quote
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Push last value
    
    // Extract fields: id, name, description, target_muscles, equipment_type, image_url, created_at, updated_at
    const [id, name, description, targetMusclesStr, equipmentType, imageUrl] = values;
    
    // Parse target_muscles JSON array
    let targetMuscles: string[] = [];
    try {
      if (targetMusclesStr && targetMusclesStr.startsWith('[')) {
        targetMuscles = JSON.parse(targetMusclesStr);
      }
    } catch (e) {
      console.warn(`Failed to parse target_muscles for ${name}:`, targetMusclesStr);
    }
    
    machines.push({
      id,
      name,
      description: description || null,
      target_muscles: targetMuscles,
      equipment_type: equipmentType || 'machine',
      image_url: imageUrl || null,
    });
  }
  
  return machines;
}

export default function ImportMachines() {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [count, setCount] = useState(0);

  const handleImport = async () => {
    setImporting(true);
    try {
      // Fetch CSV from public folder
      const response = await fetch('/data/machines.csv');
      if (!response.ok) {
        throw new Error('Failed to fetch machines.csv');
      }
      
      const text = await response.text();
      const machines = parseCSV(text);
      
      console.log(`Parsed ${machines.length} machines from CSV`);
      
      // Call edge function to import
      const { data, error } = await supabase.functions.invoke('import-machines', {
        body: { machines }
      });
      
      if (error) {
        throw error;
      }
      
      setCount(machines.length);
      setImported(true);
      toast.success(`Úspešne importovaných ${machines.length} strojov`);
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import zlyhal: ' + (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 space-y-6">
        <div className="bg-card rounded-xl p-6 border">
          <h2 className="text-lg font-semibold mb-4">Import strojov z CSV</h2>
          <p className="text-muted-foreground mb-6">
            Importuje stroje z pripraveného CSV súboru do databázy. 
            Existujúce záznamy s rovnakým ID budú aktualizované.
          </p>
          
          {imported ? (
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-medium">Importovaných {count} strojov</span>
            </div>
          ) : (
            <Button 
              onClick={handleImport} 
              disabled={importing}
              size="lg"
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importujem...' : 'Spustiť import'}
            </Button>
          )}
        </div>
        
        <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">CSV formát:</p>
          <code className="text-xs">
            id;name;description;target_muscles;equipment_type;image_url;created_at;updated_at
          </code>
        </div>
      </div>
    </AdminLayout>
  );
}
