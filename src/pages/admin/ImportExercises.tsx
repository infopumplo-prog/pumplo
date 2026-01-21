import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import * as XLSX from "xlsx";

const ImportExercises = () => {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [count, setCount] = useState(0);

  const parseXLSX = async (arrayBuffer: ArrayBuffer) => {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get raw data without headers first
    const rawData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    
    console.log("First row (sheet name):", rawData[0]);
    console.log("Second row (headers):", rawData[1]);
    console.log("Third row (first data):", rawData[2]);
    console.log("Total raw rows:", rawData.length);
    
    // Skip first row (sheet name), use second row as headers
    const headers = rawData[1] as string[];
    const dataRows = rawData.slice(2); // Skip first two rows
    
    console.log("Headers:", headers);
    console.log("Data rows count:", dataRows.length);
    
    // Only accept known exercise columns
    const validColumns = [
      'name', 'category', 'primary_muscles', 'secondary_muscles', 
      'primary_role', 'equipment_type', 'machine_id', 'difficulty',
      'exercise_with_weights', 'video_path', 'allowed_phase'
    ];
    
    const parsed = dataRows
      .map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        
        headers.forEach((header, index) => {
          // Skip columns not in our valid list
          if (!validColumns.includes(header)) {
            return;
          }
          
          const value = row[index];
          const strValue = String(value ?? "");
          
          // Array fields - parse JSON arrays
          if (["primary_muscles", "secondary_muscles"].includes(header)) {
            try {
              if (strValue && strValue.startsWith("[")) {
                obj[header] = JSON.parse(strValue);
              } else {
                obj[header] = [];
              }
            } catch (e) {
              console.warn(`Failed to parse ${header}:`, strValue);
              obj[header] = [];
            }
          } 
          // Boolean fields
          else if (header === "exercise_with_weights") {
            obj[header] = strValue.toUpperCase() === "TRUE";
          }
          // Number fields
          else if (header === "difficulty") {
            obj[header] = parseInt(strValue) || 5;
          } 
          // Nullable UUID fields
          else if (header === "machine_id") {
            obj[header] = strValue && strValue.length > 0 ? strValue : null;
          }
          // Nullable string fields
          else if (header === "primary_role") {
            obj[header] = strValue && strValue.length > 0 ? strValue : null;
          }
          // Allowed phase with default
          else if (header === "allowed_phase") {
            obj[header] = strValue && strValue.length > 0 ? strValue : "main";
          }
          // Equipment type with default
          else if (header === "equipment_type") {
            obj[header] = strValue && strValue.length > 0 ? strValue : "bodyweight";
          }
          // Video path - lowercase
          else if (header === "video_path") {
            obj[header] = strValue ? strValue.toLowerCase() : null;
          }
          // Other string fields (name, category)
          else {
            obj[header] = strValue || null;
          }
        });
        
        return obj;
      })
      // Filter out rows without a valid name (empty rows)
      .filter((row) => row.name && String(row.name).trim().length > 0);
    
    console.log("Parsed exercises sample:", parsed[0]);
    console.log("Total parsed exercises:", parsed.length);
    
    return parsed;
  };

  const handleImport = async () => {
    setImporting(true);
    
    try {
      console.log("Fetching exercises.xlsx...");
      const response = await fetch("/data/exercises.xlsx");
      console.log("Fetch response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log("ArrayBuffer size:", arrayBuffer.byteLength);
      
      const exercises = await parseXLSX(arrayBuffer);
      
      console.log(`Sending ${exercises.length} exercises to edge function`);
      
      if (exercises.length === 0) {
        toast.error("Žiadne cviky na import - skontrolujte XLSX súbor");
        return;
      }
      
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
            <CheckCircle className="w-16 h-16 text-primary" />
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
