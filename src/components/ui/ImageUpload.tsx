import { useState } from "react";
import { Camera, X, Upload, Loader2, ImageOff } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { toast } from "@/hooks/use-toast";
import { uploadImageToStorage, deleteImageFromStorage, UploadedImage } from "@/lib/imageUtils";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from 'browser-image-compression';

// Componente para thumbnail com tratamento de erro
function ImageThumbnail({ 
  image, 
  onRemove, 
  disabled 
}: { 
  image: UploadedImage; 
  onRemove: () => void; 
  disabled: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <Card className="relative group overflow-hidden">
      {hasError ? (
        <div className="w-full h-32 flex flex-col items-center justify-center bg-muted">
          <ImageOff className="h-8 w-8 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">Indisponível</span>
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-32 object-cover"
          onError={() => setHasError(true)}
        />
      )}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
        onClick={onRemove}
        disabled={disabled}
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
        {image.name}
      </div>
    </Card>
  );
}

interface ImageUploadProps {
  bucketName: 'daily-service-photos' | 'service-order-photos';
  maxImages?: number;
  onImagesChange: (images: UploadedImage[]) => void;
  existingImages?: UploadedImage[];
  disabled?: boolean;
}

export function ImageUpload({
  bucketName,
  maxImages = 5,
  onImagesChange,
  existingImages = [],
  disabled = false
}: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>(existingImages);
  const [uploading, setUploading] = useState(false);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Erro ao comprimir imagem:', error);
      return file; // Retorna original se houver erro
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Você pode adicionar no máximo ${maxImages} fotos.`,
        variant: "destructive"
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const uploadPromises = filesToUpload.map(async (file) => {
        // Comprimir imagem antes do upload
        const compressedFile = await compressImage(file);
        const result = await uploadImageToStorage(compressedFile, bucketName, user.id);
        
        if (result.error) {
          toast({
            title: "Erro no upload",
            description: result.error,
            variant: "destructive"
          });
          return null;
        }

        return {
          url: result.url,
          name: file.name,
          uploaded_at: new Date().toISOString()
        };
      });

      const uploadedImages = (await Promise.all(uploadPromises)).filter(
        (img): img is UploadedImage => img !== null
      );

      const newImages = [...images, ...uploadedImages];
      setImages(newImages);
      onImagesChange(newImages);

      toast({
        title: "Fotos adicionadas",
        description: `${uploadedImages.length} foto(s) adicionada(s) com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload das fotos.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Resetar input
      event.target.value = '';
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = images[index];
    
    // Deletar do storage
    const { success, error } = await deleteImageFromStorage(imageToRemove.url, bucketName);
    
    if (!success) {
      toast({
        title: "Erro ao remover",
        description: error || "Não foi possível remover a foto.",
        variant: "destructive"
      });
      return;
    }

    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);

    toast({
      title: "Foto removida",
      description: "A foto foi removida com sucesso."
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Fotos do Atendimento
        </label>
        <span className="text-sm text-muted-foreground">
          {images.length}/{maxImages}
        </span>
      </div>

      {/* Grid de thumbnails */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {images.map((image, index) => (
          <ImageThumbnail
            key={index}
            image={image}
            onRemove={() => handleRemoveImage(index)}
            disabled={disabled || uploading}
          />
        ))}

        {/* Botões de adicionar - Câmera e Galeria */}
        {images.length < maxImages && (
          <>
            {/* Botão Câmera */}
            <label className="cursor-pointer">
              <Card className="h-32 flex flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">
                      Câmera
                    </span>
                  </>
                )}
              </Card>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled || uploading}
                capture="environment"
              />
            </label>

            {/* Botão Galeria */}
            <label className="cursor-pointer">
              <Card className="h-32 flex flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">
                      Galeria
                    </span>
                  </>
                )}
              </Card>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  console.log('[ImageUpload] Galeria input triggered, files:', e.target.files);
                  handleFileSelect(e);
                }}
                disabled={disabled || uploading}
              />
            </label>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <Upload className="h-3 w-3 inline mr-1" />
        Formatos aceitos: JPG, PNG, WEBP • Tamanho máximo: 5MB por foto
      </p>
    </div>
  );
}
