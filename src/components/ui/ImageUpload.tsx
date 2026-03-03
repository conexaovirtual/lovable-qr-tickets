import { useState, useRef, useCallback } from "react"; // v2
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg' as const, // Always output JPEG for compatibility
    };
    
    try {
      const compressed = await imageCompression(file, options);
      console.log(`[ImageUpload] Compressed ${file.name}: ${(file.size/1024).toFixed(0)}KB -> ${(compressed.size/1024).toFixed(0)}KB`);
      return compressed;
    } catch (error) {
      console.error('[ImageUpload] Compression error:', error);
      return file;
    }
  };

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      console.log('[ImageUpload] No files selected');
      return;
    }

    console.log(`[ImageUpload] Processing ${files.length} file(s):`, 
      Array.from(files).map(f => `${f.name} (${f.type}, ${(f.size/1024).toFixed(0)}KB)`));

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

      const uploadedImages: UploadedImage[] = [];

      for (const file of filesToUpload) {
        try {
          // Check if file is an image (accept broad types including HEIC from mobile)
          if (!file.type.startsWith('image/') && file.type !== '' && file.type !== 'application/octet-stream') {
            console.warn(`[ImageUpload] Skipping non-image file: ${file.name} (${file.type})`);
            toast({
              title: "Arquivo ignorado",
              description: `${file.name} não é uma imagem válida.`,
              variant: "destructive"
            });
            continue;
          }

          // Check size (max 10MB before compression, will be compressed down)
          if (file.size > 10 * 1024 * 1024) {
            toast({
              title: "Arquivo muito grande",
              description: `${file.name} excede 10MB.`,
              variant: "destructive"
            });
            continue;
          }

          // Compress image (handles HEIC conversion too via browser-image-compression)
          const compressedFile = await compressImage(file);
          
          // Upload directly to storage (skip the validation in imageUtils that rejects HEIC)
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const fileName = `${user.id}/${timestamp}_${random}.jpg`;

          const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, compressedFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/jpeg',
            });

          if (error) {
            console.error(`[ImageUpload] Storage upload error for ${file.name}:`, error);
            toast({
              title: "Erro no upload",
              description: `Falha ao enviar ${file.name}: ${error.message}`,
              variant: "destructive"
            });
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(data.path);

          console.log(`[ImageUpload] Upload success: ${file.name} -> ${publicUrl}`);

          uploadedImages.push({
            url: publicUrl,
            name: file.name,
            uploaded_at: new Date().toISOString()
          });
        } catch (fileErr) {
          console.error(`[ImageUpload] Error processing ${file.name}:`, fileErr);
          toast({
            title: "Erro",
            description: `Erro ao processar ${file.name}.`,
            variant: "destructive"
          });
        }
      }

      if (uploadedImages.length > 0) {
        const newImages = [...images, ...uploadedImages];
        setImages(newImages);
        onImagesChange(newImages);

        toast({
          title: "Fotos adicionadas",
          description: `${uploadedImages.length} foto(s) adicionada(s) com sucesso.`
        });
      }
    } catch (error) {
      console.error('[ImageUpload] General upload error:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload das fotos.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [images, maxImages, bucketName, onImagesChange]);

  const handleCameraClick = useCallback(() => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  }, []);

  const handleGalleryClick = useCallback(() => {
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    console.log('[ImageUpload] Input change event, files:', files?.length);
    processFiles(files);
    // Reset input value to allow re-selecting same file
    event.target.value = '';
  }, [processFiles]);

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = images[index];
    
    const { success, error } = await deleteImageFromStorage(imageToRemove.url, bucketName);
    
    if (!success) {
      console.warn('[ImageUpload] Delete from storage failed (might be already deleted):', error);
      // Still remove from UI even if storage delete fails
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
      {/* Hidden file inputs - separated from UI to avoid gesture issues on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

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
            key={`${image.url}-${index}`}
            image={image}
            onRemove={() => handleRemoveImage(index)}
            disabled={disabled || uploading}
          />
        ))}

        {/* Botões de adicionar - Câmera e Galeria */}
        {images.length < maxImages && (
          <>
            {/* Botão Câmera - uses onClick for direct user gesture */}
            <Card 
              className="h-32 flex flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-colors cursor-pointer"
              onClick={handleCameraClick}
            >
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

            {/* Botão Galeria - uses onClick for direct user gesture */}
            <Card 
              className="h-32 flex flex-col items-center justify-center border-2 border-dashed hover:border-primary transition-colors cursor-pointer"
              onClick={handleGalleryClick}
            >
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
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <Upload className="h-3 w-3 inline mr-1" />
        Formatos aceitos: JPG, PNG, WEBP, HEIC • Máx: 10MB por foto
      </p>
    </div>
  );
}
