/**
 * Formatting utilities for Brazilian data formats (CNPJ, Phone, Date)
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formats CNPJ to pattern: 00.000.000/0000-00
 */
export const formatCNPJ = (value: string): string => {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
};

/**
 * Formats Brazilian phone to patterns:
 * - (XX) XXXX-XXXX (landline - 10 digits)
 * - (XX) 9XXXX-XXXX (mobile - 11 digits)
 */
export const formatPhone = (value: string): string => {
  const cleaned = value.replace(/[^\d]/g, '');
  
  if (cleaned.length <= 10) {
    // Landline format: (XX) XXXX-XXXX
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  }
  
  // Mobile format: (XX) 9XXXX-XXXX
  return cleaned
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

/**
 * Formats a date-only string (YYYY-MM-DD) to Brazilian format (dd/MM/yyyy)
 * Uses string manipulation to avoid timezone issues completely.
 */
export const formatDateBR = (dateString: string): string => {
  if (!dateString) return '-';
  // For date-only strings (YYYY-MM-DD), parse directly without Date object to avoid timezone issues
  if (!dateString.includes('T')) {
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }
  // For full ISO strings, use date-fns
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
};
