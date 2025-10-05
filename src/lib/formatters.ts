/**
 * Formatting utilities for Brazilian data formats (CNPJ, Phone)
 */

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
