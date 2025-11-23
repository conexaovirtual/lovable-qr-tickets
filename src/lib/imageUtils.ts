import { supabase } from "@/integrations/supabase/client";

export interface UploadedImage {
  url: string;
  name: string;
  uploaded_at: string;
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeMB = 5;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de arquivo inválido. Use JPG, PNG ou WEBP.'
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`
    };
  }

  return { valid: true };
}

/**
 * Comprime uma imagem antes do upload
 */
export async function compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calcular novas dimensões mantendo aspect ratio
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Converter para blob com qualidade ajustada
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          file.type,
          0.85
        );
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
  });
}

/**
 * Faz upload de imagem para o Supabase Storage
 */
export async function uploadImageToStorage(
  file: File,
  bucketName: 'daily-service-photos' | 'service-order-photos',
  userId: string
): Promise<{ url: string; error?: string }> {
  try {
    // Validar arquivo
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { url: '', error: validation.error };
    }

    // Comprimir imagem se necessário
    let fileToUpload = file;
    if (file.size > 1024 * 1024) { // Se maior que 1MB
      fileToUpload = await compressImage(file);
    }

    // Gerar nome único
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const fileName = `${userId}/${timestamp}_${random}.${extension}`;

    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Erro ao fazer upload:', error);
      return { url: '', error: error.message };
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return { url: publicUrl };
  } catch (error) {
    console.error('Erro no upload:', error);
    return { 
      url: '', 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao fazer upload' 
    };
  }
}

/**
 * Deleta imagem do Supabase Storage
 */
export async function deleteImageFromStorage(
  url: string,
  bucketName: 'daily-service-photos' | 'service-order-photos'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extrair o caminho do arquivo da URL
    const urlParts = url.split(`/${bucketName}/`);
    if (urlParts.length < 2) {
      return { success: false, error: 'URL inválida' };
    }
    
    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Erro ao deletar:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao deletar' 
    };
  }
}

/**
 * Cache de imagens em base64 para evitar downloads repetidos
 */
const imageCache = new Map<string, string>();

/**
 * Converte URL de imagem para base64 (para uso no PDF)
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao converter imagem para base64:', error);
    throw error;
  }
}

/**
 * Converte URL de imagem para base64 com cache e redimensionamento
 */
export async function imageUrlToBase64Cached(url: string): Promise<string> {
  // Verificar cache
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Criar imagem para redimensionar
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Redimensionar mantendo aspect ratio (máximo 800px de largura)
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Converter para base64
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        
        // Armazenar em cache
        imageCache.set(url, base64);
        
        // Limpar objeto URL
        URL.revokeObjectURL(objectUrl);
        
        resolve(base64);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem'));
      };
      
      img.src = objectUrl;
    });
  } catch (error) {
    console.error('Erro ao converter imagem para base64:', error);
    throw error;
  }
}

/**
 * Limpa o cache de imagens
 */
export function clearImageCache() {
  imageCache.clear();
}

