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
 * Parses a date-only string (YYYY-MM-DD) avoiding timezone issues.
 * Adding T12:00:00 ensures the date is interpreted correctly in any timezone.
 */
export const parseDateString = (dateString: string): Date => {
  if (!dateString) return new Date();
  // If it's already a full ISO string, parse directly
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  // For date-only strings, add noon time to avoid timezone issues
  return new Date(dateString + 'T12:00:00');
};

/**
 * Formats a date-only string (YYYY-MM-DD) to Brazilian format (dd/MM/yyyy)
 * Handles timezone issues correctly.
 */
export const formatDateBR = (dateString: string): string => {
  if (!dateString) return '-';
  return format(parseDateString(dateString), 'dd/MM/yyyy', { locale: ptBR });
};
