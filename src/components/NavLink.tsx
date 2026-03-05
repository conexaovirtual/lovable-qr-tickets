import { NavLink as RouterNavLink, NavLinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props extends NavLinkProps {
  activeClassName?: string;
}

export function NavLink({ className, activeClassName = '', ...props }: Props) {
  return (
    <RouterNavLink
      className={({ isActive }) =>
        cn(className, isActive && activeClassName)
      }
      {...props}
    />
  );
}
