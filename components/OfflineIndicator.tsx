import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  position?: 'bottom-left' | 'top-right';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'bottom-left',
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  const posClass =
    position === 'top-right' ? 'top-16 right-4' : 'bottom-4 left-4';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed ${posClass} z-40 inline-flex items-center gap-2 rounded-full apple-glass border border-amber-500/30 bg-amber-50/90 px-3.5 py-1.5 text-xs font-medium text-amber-900 shadow-[0_8px_24px_rgba(0,0,0,0.08)]`}
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span>Oflayn rejim — keshlangan darslar va 3D modellar faol</span>
    </div>
  );
};
