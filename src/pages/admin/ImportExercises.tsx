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

  // UUID validation regex
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Valid training roles from database
  const validRoles = [
    'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
    'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'shoulder_adduction',
    'shoulder_external_rotation', 'shoulder_internal_rotation',
    'squat', 'hinge', 'lunge', 'step', 'jump',
    'anti_extension', 'anti_flexion', 'anti_rotation', 'rotation', 'lateral_flexion',
    'cyclical_pull', 'cyclical_push', 'full_body_pull'
  ];

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
          // Nullable UUID fields - validate UUID format
          else if (header === "machine_id") {
            if (strValue && strValue.length > 0 && isValidUUID(strValue)) {
              obj[header] = strValue;
            } else {
              if (strValue && strValue.length > 0) {
                console.warn(`Invalid UUID for machine_id: ${strValue}`);
              }
              obj[header] = null;
            }
          }
          // Nullable string fields - validate against training_roles
          else if (header === "primary_role") {
            if (strValue && validRoles.includes(strValue)) {
              obj[header] = strValue;
            } else {
              if (strValue && strValue.length > 0) {
                console.warn(`Invalid primary_role: ${strValue}`);
              }
              obj[header] = null;
            }
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
    
    // Log validation issues
    const invalidRows = dataRows.filter((row: unknown[], index: number) => {
      const nameIndex = headers.indexOf('name');
      const name = row[nameIndex];
      return !name || String(name).trim().length === 0;
    });
    
    if (invalidRows.length > 0) {
      console.warn(`Skipped ${invalidRows.length} rows without valid name`);
    }
    
    // Log invalid primary_roles
    const roleIndex = headers.indexOf('primary_role');
    const invalidRoles = dataRows
      .map((row: unknown[]) => row[roleIndex])
      .filter((role) => role && !validRoles.includes(String(role)));
    const uniqueInvalidRoles = [...new Set(invalidRoles.map(String))];
    if (uniqueInvalidRoles.length > 0) {
      console.warn(`Invalid primary_role values found (will be set to null):`, uniqueInvalidRoles);
    }
    
    // Log invalid UUIDs
    const machineIdIndex = headers.indexOf('machine_id');
    const invalidUUIDs = dataRows
      .map((row: unknown[]) => row[machineIdIndex])
      .filter((id) => id && String(id).length > 0 && !isValidUUID(String(id)));
    const uniqueInvalidUUIDs = [...new Set(invalidUUIDs.map(String))];
    if (uniqueInvalidUUIDs.length > 0) {
      console.warn(`Invalid machine_id UUIDs found (will be set to null):`, uniqueInvalidUUIDs);
    }
    
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
