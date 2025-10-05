import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield } from 'lucide-react';

// Phase 3: Privacy Enhancement Component
export function PhoneVisibilitySettings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<string>(
    profile?.phone_visibility || 'everyone'
  );

  const handleVisibilityChange = async (newVisibility: string) => {
    if (!profile) return;

    // Type guard for phone_visibility
    if (newVisibility !== 'everyone' && newVisibility !== 'managers_only' && newVisibility !== 'private') {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone_visibility: newVisibility })
      .eq('id', profile.id);

    if (error) {
      toast.error('Erro ao atualizar privacidade', {
        description: error.message,
      });
    } else {
      setVisibility(newVisibility);
      toast.success('Privacidade atualizada', {
        description: 'Suas preferências de privacidade foram salvas.',
      });
    }
    setLoading(false);
  };

  const getVisibilityIcon = (value: string) => {
    switch (value) {
      case 'everyone':
        return <Eye className="h-4 w-4" />;
      case 'managers_only':
        return <Shield className="h-4 w-4" />;
      case 'private':
        return <EyeOff className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getVisibilityDescription = (value: string) => {
    switch (value) {
      case 'everyone':
        return 'Todos os colegas da sua empresa podem ver seu telefone';
      case 'managers_only':
        return 'Apenas gestores e administradores podem ver seu telefone';
      case 'private':
        return 'Seu telefone não será visível para outros usuários';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="space-y-2">
        <Label htmlFor="phone-visibility" className="flex items-center gap-2">
          {getVisibilityIcon(visibility)}
          Privacidade do Telefone
        </Label>
        <Select
          value={visibility}
          onValueChange={handleVisibilityChange}
          disabled={loading}
        >
          <SelectTrigger id="phone-visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>Todos (Padrão)</span>
              </div>
            </SelectItem>
            <SelectItem value="managers_only">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Apenas Gestores</span>
              </div>
            </SelectItem>
            <SelectItem value="private">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                <span>Privado</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {getVisibilityDescription(visibility)}
        </p>
      </div>
    </div>
  );
}
