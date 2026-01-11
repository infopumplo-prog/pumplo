import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";

const ImportExercises = () => {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [count, setCount] = useState(0);

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(";");
    
    return lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ";" && !inQuotes) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);
      
      const obj: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        const value = values[i] || "";
        
        // Array fields
        if (["primary_muscles", "secondary_muscles", "contraindicated_injuries", "workout_split", "equipment"].includes(header)) {
          try {
            const cleaned = value.replace(/\\/g, "").replace(/""/g, '"');
            obj[header] = JSON.parse(cleaned || "[]");
          } catch {
            obj[header] = [];
          }
        } 
        // Boolean fields
        else if (header === "requires_machine") {
          obj[header] = value.toLowerCase() === "true";
        }
        else if (header === "exercise_with_weights") {
          obj[header] = value.toLowerCase() === "true";
        }
        // Number fields
        else if (header === "difficulty") {
          obj[header] = parseInt(value) || 5;
        } 
        // Nullable UUID fields
        else if (header === "machine_id") {
          obj[header] = value && value.length > 0 ? value : null;
        }
        // Nullable string fields
        else if (header === "primary_role" || header === "secondary_role") {
          obj[header] = value && value.length > 0 ? value : null;
        }
        // Skip timestamps
        else if (header === "created_at" || header === "updated_at") {
          // Let DB handle timestamps
        } 
        // Other string fields
        else {
          obj[header] = value || null;
        }
      });
      
      return obj;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    
    try {
      const response = await fetch("/data/exercises.csv");
      const text = await response.text();
      const exercises = parseCSV(text);
      
      console.log(`Parsed ${exercises.length} exercises`);
      
      const { data, error } = await supabase.functions.invoke("import-exercises", {
        body: { exercises },
      });
      
      if (error) throw error;
      
      setCount(data.count);
      setImported(true);
      toast.success(`Úspešne importovaných ${data.count} cvikov!`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Chyba pri importe: " + (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-bold">Import cvikov</h2>
        
        {imported ? (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <p className="text-lg">Importovaných {count} cvikov</p>
          </div>
        ) : (
          <Button 
            onClick={handleImport} 
            disabled={importing}
            size="lg"
            className="gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importujem...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Spustiť import
              </>
            )}
          </Button>
        )}
      </div>
    </AdminLayout>
  );
};

export default ImportExercises;
