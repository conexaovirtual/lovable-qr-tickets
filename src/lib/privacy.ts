// Phase 3: Privacy Enhancement - Phone visibility filtering logic

import { UserProfile } from '@/hooks/useAuth';

/**
 * Determines if the current user can view another user's phone number
 * based on privacy settings and roles.
 */
export function canViewPhone(
  targetProfile: UserProfile,
  currentUserProfile: UserProfile | null,
  currentUserRoles: string[]
): boolean {
  // No current user - cannot view
  if (!currentUserProfile) return false;

  // Admins can always view
  if (currentUserRoles.includes('admin_provedor')) return true;

  // Same user can always view their own phone
  if (targetProfile.id === currentUserProfile.id) return true;

  // Different company - cannot view
  if (targetProfile.company_id !== currentUserProfile.company_id) return false;

  // Apply visibility rules
  const visibility = targetProfile.phone_visibility || 'everyone';

  switch (visibility) {
    case 'everyone':
      return true;

    case 'managers_only':
      // Managers and admins can view
      return currentUserRoles.includes('gestor_cliente') || 
             currentUserRoles.includes('admin_provedor');

    case 'private':
      // Only the user themselves and admins
      return false;

    default:
      return true; // Default to everyone for backwards compatibility
  }
}

/**
 * Filters a phone number based on visibility rules.
 * Returns the phone number if visible, otherwise returns a masked string.
 */
export function filterPhone(
  phone: string | null,
  targetProfile: UserProfile,
  currentUserProfile: UserProfile | null,
  currentUserRoles: string[]
): string | null {
  if (!phone) return null;

  if (canViewPhone(targetProfile, currentUserProfile, currentUserRoles)) {
    return phone;
  }

  return '••• •••• ••••'; // Masked phone number
}
