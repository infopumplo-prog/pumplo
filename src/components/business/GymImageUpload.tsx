import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GymImageUploadProps {
  type: 'cover' | 'logo';
  currentUrl: string | null;
  onUploadComplete: (url: string) => void;
  className?: string;
}

const GymImageUpload = ({ type, currentUrl, onUploadComplete, className }: GymImageUploadProps) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Prosím vyberte obrázek');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Obrázek je příliš velký (max 5MB)');
      return;
    }

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('gym-images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Nepodařilo se nahrát obrázek');
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gym-images')
      .getPublicUrl(fileName);

    onUploadComplete(publicUrl);
    setIsUploading(false);
    toast.success('Obrázek byl nahrán');
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (type === 'logo') {
    return (
      <div className={cn("relative", className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className="w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center bg-muted/50 overflow-hidden"
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : currentUrl ? (
            <img src={currentUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-6 h-6 text-muted-foreground" />
          )}
        </button>
        <span className="text-xs text-muted-foreground mt-1 block text-center">Logo</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className="w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center bg-muted/50 overflow-hidden"
      >
        {isUploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : currentUrl ? (
          <img src={currentUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <>
            <ImageIcon className="w-6 h-6 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Přidat titulní fotku</span>
          </>
        )}
      </button>
    </div>
  );
};

export default GymImageUpload;