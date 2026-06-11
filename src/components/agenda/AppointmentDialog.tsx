import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, Loader2, CalendarDays, Clock, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppointmentType = 'compromisso' | 'reuniao' | 'ligacao' | 'visita' | 'outro';

type FormValues = {
  title: string;
  description: string;
  appointment_date: string;
  appointment_time: string;
  end_time: string;
  type: AppointmentType;
  notify_minutes: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  prefill?: Partial<FormValues>;
  editId?: string;
};

// ── Converte números por extenso (PT-BR) para inteiros ─────────────────────
function ptWordToNumber(text: string): number | null {
  const units: Record<string, number> = {
    zero:0, um:1, uma:1, dois:2, duas:2, três:3, tres:3, quatro:4,
    cinco:5, seis:6, sete:7, oito:8, nove:9, dez:10, onze:11, doze:12,
    treze:13, quatorze:14, catorze:14, quinze:15, dezesseis:16, dezessete:17,
    dezoito:18, dezenove:19, vinte:20, trinta:30, quarenta:40, cinquenta:50,
    sessenta:60, setenta:70, oitenta:80, noventa:90,
  };
  const clean = text.trim().toLowerCase();
  // "vinte e cinco", "trinta e dois", etc.
  const compoundMatch = clean.match(/^(\w+)\s+e\s+(\w+)$/);
  if (compoundMatch) {
    const a = units[compoundMatch[1]];
    const b = units[compoundMatch[2]];
    if (a !== undefined && b !== undefined) return a + b;
  }
  return units[clean] ?? null;
}

// ── Normaliza números por extenso no texto antes de parsear ────────────────
function normalizeNumbers(text: string): string {
  // Horários: "sete e trinta" → "7:30", "sete e meia" → "7:30", "sete horas" → "7h"
  let t = text;

  // "X e meia" → "X:30" (sete e meia → 7:30)
  t = t.replace(/\b(\w+)\s+e\s+meia\b/g, (_, h) => {
    const n = ptWordToNumber(h);
    return n !== null ? `${n}:30` : _;
  });

  // "X e Y" como horário (sete e trinta → 7:30)
  t = t.replace(/\b(\w+)\s+e\s+(\w+)\b/g, (full, a, b) => {
    const ha = ptWordToNumber(a);
    const mb = ptWordToNumber(b);
    // só converte se parecer horário (h < 24, min < 60)
    if (ha !== null && mb !== null && ha < 24 && mb < 60 && mb > 0) {
      return `${ha}:${String(mb).padStart(2, '0')}`;
    }
    // senão tenta como número somado (trinta e dois = 32)
    if (ha !== null && mb !== null) return String(ha + mb);
    return full;
  });

  // Números isolados por extenso que restaram
  const numberWords = ['zero','um','uma','dois','duas','três','tres','quatro','cinco','seis',
    'sete','oito','nove','dez','onze','doze','treze','quatorze','catorze','quinze',
    'dezesseis','dezessete','dezoito','dezenove','vinte','trinta','quarenta','cinquenta',
    'sessenta','setenta','oitenta','noventa'];
  for (const w of numberWords) {
    const n = ptWordToNumber(w);
    if (n !== null) {
      t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), String(n));
    }
  }

  return t;
}

function parsePortugueseDateTime(rawText: string): Partial<FormValues> {
  // Normaliza números por extenso primeiro
  const text = normalizeNumbers(rawText);
  const lower = text.toLowerCase().trim();
  const today = new Date();
  let date: Date | null = null;
  let time: string = '';
  let notify_minutes: number | undefined;
  let type: AppointmentType | undefined;
  let description: string = '';

  const toRemove: string[] = [];

  // ── 1. notify_minutes ────────────────────────────────────────────────────────
  // Padrões flexíveis — aceita com ou sem acento em "antecedencia"
  const notifyPatterns: RegExp[] = [
    /me\s+avis[ae]\s+com\s+(\d+)\s*(?:minutos?|min|horas?)\s*de\s+antecedên?c[ií]a/i,
    /avis[ae]\s+com\s+(\d+)\s*(?:minutos?|min|horas?)\s*de\s+antecedên?c[ií]a/i,
    /com\s+(\d+)\s*(?:minutos?|min|horas?)\s*de\s+antecedên?c[ií]a/i,
    /me\s+avis[ae]\s+(\d+)\s*(?:minutos?|min)\s*antes/i,
    /avis[ae]\s+(\d+)\s*(?:minutos?|min)\s*antes/i,
    /(\d+)\s*(?:minutos?|min)\s*antes/i,
  ];
  for (const p of notifyPatterns) {
    const m = lower.match(p);
    if (m) {
      const val = parseInt(m[1]);
      // se capturou horas, converte para minutos
      notify_minutes = /hora/i.test(m[0]) ? val * 60 : val;
      toRemove.push(m[0]);
      break;
    }
  }

  // ── 2. Descrição: "para + [finalidade]" ──────────────────────────────────────
  // Remove notify antes de capturar descrição para não confundir "para X minutos"
  let lowerForDesc = lower;
  for (const chunk of toRemove) lowerForDesc = lowerForDesc.replace(chunk, ' ');

  // Captura "para montar...", "para instalar...", "para discutir..." etc.
  // Para as horas ("para as 14h") é ignorado pelo lookahead
  const descMatch = lowerForDesc.match(/\bpara\s+(?!a[s]?\s*\d)([^.!?]{4,}?)(?=[.!?]|$)/i);
  if (descMatch) {
    const candidate = descMatch[1].replace(/\s+/g, ' ').trim();
    if (candidate.length > 3 && !/^\d/.test(candidate)) {
      description = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      // Remove do lower também para não ir pro título
      const fullMatch = descMatch[0].trim();
      toRemove.push(fullMatch);
    }
  }

  // ── 3. Data ──────────────────────────────────────────────────────────────────
  const dateTests: [RegExp, () => Date][] = [
    [/depois\s+de\s+amanh[ãa]/, () => addDays(today, 2)],
    [/amanh[ãa]/, () => addDays(today, 1)],
    [/hoje/, () => today],
    [/segunda[-\s]?(?:feira)?/, () => nextMonday(today)],
    [/ter[çc][ãa][-\s]?(?:feira)?/, () => nextTuesday(today)],
    [/quarta[-\s]?(?:feira)?/, () => nextWednesday(today)],
    [/quinta[-\s]?(?:feira)?/, () => nextThursday(today)],
    [/sexta[-\s]?(?:feira)?/, () => nextFriday(today)],
    [/s[áa]bado/, () => { const d = new Date(today); d.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7)); return d; }],
    [/domingo/, () => { const d = new Date(today); d.setDate(today.getDate() + ((0 - today.getDay() + 7) % 7 || 7)); return d; }],
  ];
  for (const [pattern, fn] of dateTests) {
    const m = lower.match(pattern);
    if (m) { date = fn(); toRemove.push(m[0]); break; }
  }
  if (!date) {
    const diaMatch = lower.match(/\bdia\s+(\d{1,2})(?:\/(\d{1,2}))?/);
    if (diaMatch) {
      const d = parseInt(diaMatch[1]);
      const mo = diaMatch[2] ? parseInt(diaMatch[2]) - 1 : today.getMonth();
      const candidate = new Date(today.getFullYear(), mo, d);
      date = candidate >= today ? candidate : new Date(today.getFullYear() + 1, mo, d);
      toRemove.push(diaMatch[0]);
    }
  }

  // ── 4. Horário ───────────────────────────────────────────────────────────────
  const timePatterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/[àa]s?\s*(\d{1,2})[h:]\s*(\d{2})/, (m) => `${m[1].padStart(2,'0')}:${m[2]}`],
    [/[àa]s?\s*(\d{1,2})\s*(?:horas?|h)\b/, (m) => `${m[1].padStart(2,'0')}:00`],
    [/meio[-\s]dia/, () => '12:00'],
    [/meia[-\s]noite/, () => '00:00'],
    [/\b(\d{1,2}):(\d{2})\b/, (m) => `${m[1].padStart(2,'0')}:${m[2]}`],
    [/\b(\d{1,2})h(\d{2})\b/, (m) => `${m[1].padStart(2,'0')}:${m[2]}`],
    [/\b(\d{1,2})h\b/, (m) => `${m[1].padStart(2,'0')}:00`],
  ];
  for (const [pattern, fn] of timePatterns) {
    const m = lower.match(pattern);
    if (m) {
      const result = fn(m);
      const [h, min] = result.split(':').map(Number);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        time = result;
        // Remove o trecho do horário + "da manhã/tarde/noite" se vier logo depois
        const afterTime = lower.slice(lower.indexOf(m[0]) + m[0].length);
        const periodMatch = afterTime.match(/^\s*da\s+(?:manh[ãa]|tarde|noite)\b/i);
        toRemove.push(m[0] + (periodMatch ? periodMatch[0] : ''));
        break;
      }
    }
  }

  // ── 5. Tipo ──────────────────────────────────────────────────────────────────
  const typeEntries: [RegExp, AppointmentType][] = [
    [/\breuni[ãa]o\b/, 'reuniao'],
    [/\blig[aã](ção|cao|r)\b/, 'ligacao'],
    [/\bvisita\b/, 'visita'],
    [/\bcompromisso\b/, 'compromisso'],
  ];
  for (const [pattern, t] of typeEntries) {
    if (pattern.test(lower)) { type = t; break; }
  }

  // ── 6. Isolar título ─────────────────────────────────────────────────────────
  toRemove.sort((a, b) => b.length - a.length);
  let titleRaw = lower;
  for (const chunk of toRemove) {
    titleRaw = titleRaw.replace(chunk, ' ');
  }

  // Remove "me avise", "me avisa" soltos que restaram
  titleRaw = titleRaw.replace(/\bme\s+avis[ae]\b/gi, ' ');

  // Capitaliza cada palavra (nomes próprios)
  const title = titleRaw
    .replace(/[,;.!?]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

  return {
    title: title || rawText,
    description,
    appointment_date: date ? format(date, 'yyyy-MM-dd') : '',
    appointment_time: time,
    type,
    ...(notify_minutes !== undefined ? { notify_minutes } : {}),
  };
}

export function AppointmentDialog({ open, onOpenChange, onSuccess, prefill, editId }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: '', description: '', appointment_date: format(new Date(), 'yyyy-MM-dd'),
      appointment_time: '', end_time: '', type: 'compromisso', notify_minutes: 15,
    },
  });

  const { status: voiceStatus, startListening, stopListening, isSupported: voiceSupported } = useVoiceInput({
    onFinalResult: (raw) => {
      setVoiceTranscript(raw);
      const parsed = parsePortugueseDateTime(raw);
      if (parsed.title) setValue('title', parsed.title);
      if (parsed.appointment_date) setValue('appointment_date', parsed.appointment_date);
      if (parsed.appointment_time) setValue('appointment_time', parsed.appointment_time);
      if (parsed.type) setValue('type', parsed.type);
      toast({ title: 'Voz capturada', description: `"${raw}"` });
    },
    onError: (err) => toast({ title: 'Erro de voz', description: err, variant: 'destructive' }),
  });

  const isListening = voiceStatus === 'listening';

  useEffect(() => {
    if (open) {
      reset({
        title: prefill?.title || '',
        description: prefill?.description || '',
        appointment_date: prefill?.appointment_date || format(new Date(), 'yyyy-MM-dd'),
        appointment_time: prefill?.appointment_time || '',
        end_time: prefill?.end_time || '',
        type: prefill?.type || 'compromisso',
        notify_minutes: prefill?.notify_minutes ?? 15,
      });
      setVoiceTranscript('');
    }
  }, [open, prefill, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload = {
        user_id: profile.id,
        title: values.title,
        description: values.description || null,
        appointment_date: values.appointment_date,
        appointment_time: values.appointment_time || null,
        end_time: values.end_time || null,
        type: values.type,
        notify_minutes: values.notify_minutes,
        status: 'agendado',
      };

      const { error } = editId
        ? await supabase.from('appointments').update(payload).eq('id', editId)
        : await supabase.from('appointments').insert(payload);

      if (error) throw error;
      toast({ title: editId ? 'Compromisso atualizado!' : 'Compromisso criado!', description: values.title });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const typeLabel: Record<AppointmentType, string> = {
    compromisso: 'Compromisso', reuniao: 'Reunião', ligacao: 'Ligação', visita: 'Visita', outro: 'Outro',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {editId ? 'Editar Compromisso' : 'Novo Compromisso'}
          </DialogTitle>
        </DialogHeader>

        {/* Botão de voz */}
        {voiceSupported && (
          <div className="flex flex-col items-center gap-2 py-2">
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="lg"
              className={cn('w-full gap-2 transition-all', isListening && 'animate-pulse')}
              onClick={isListening ? stopListening : () => startListening()}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {isListening ? 'Ouvindo... clique para parar' : '🎤 Criar por voz'}
            </Button>
            {voiceTranscript && (
              <p className="text-xs text-muted-foreground text-center italic">"{voiceTranscript}"</p>
            )}
            {isListening && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Diga: "Reunião com fulano amanhã às 14h"
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...register('title', { required: 'Informe o título' })} placeholder="Ex: Reunião com cliente" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="appointment_date" className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Data *
              </Label>
              <Input id="appointment_date" type="date" {...register('appointment_date', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type">Tipo</Label>
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as AppointmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="appointment_time" className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Início
              </Label>
              <Input id="appointment_time" type="time" {...register('appointment_time')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_time">Fim</Label>
              <Input id="end_time" type="time" {...register('end_time')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notify_minutes" className="flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" /> Avisar antes (minutos)
            </Label>
            <Select value={String(watch('notify_minutes'))} onValueChange={(v) => setValue('notify_minutes', parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 30, 60].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} min antes</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" {...register('description')} placeholder="Detalhes do compromisso..." rows={2} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editId ? 'Salvar' : 'Criar Compromisso'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
