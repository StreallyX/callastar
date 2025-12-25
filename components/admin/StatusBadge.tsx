import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  type?: 'payment' | 'payout' | 'refund' | 'booking';
  className?: string;
}

export function StatusBadge({ status, type = 'payment', className }: StatusBadgeProps) {
  const getStatusConfig = () => {
    const upperStatus = status.toUpperCase();
    
    switch (type) {
      case 'payment':
        switch (upperStatus) {
          case 'SUCCEEDED':
            return { label: 'Réussi', color: 'bg-green-500 hover:bg-green-600' };
          case 'FAILED':
            return { label: 'Échoué', color: 'bg-red-500 hover:bg-red-600' };
          case 'REFUNDED':
            return { label: 'Remboursé', color: 'bg-yellow-500 hover:bg-yellow-600' };
          case 'PROCESSING':
            return { label: 'En cours', color: 'bg-blue-500 hover:bg-blue-600' };
          default:
            return { label: status, color: 'bg-gray-500 hover:bg-gray-600' };
        }
      
      case 'payout':
        switch (upperStatus) {
          case 'PAID':
            return { label: 'Payé', color: 'bg-green-500 hover:bg-green-600' };
          case 'PENDING':
            return { label: 'En attente', color: 'bg-yellow-500 hover:bg-yellow-600' };
          case 'PROCESSING':
            return { label: 'En cours', color: 'bg-blue-500 hover:bg-blue-600' };
          case 'FAILED':
            return { label: 'Échoué', color: 'bg-red-500 hover:bg-red-600' };
          default:
            return { label: status, color: 'bg-gray-500 hover:bg-gray-600' };
        }
      
      case 'refund':
        switch (upperStatus) {
          case 'SUCCEEDED':
            return { label: 'Réussi', color: 'bg-green-500 hover:bg-green-600' };
          case 'PENDING':
            return { label: 'En attente', color: 'bg-yellow-500 hover:bg-yellow-600' };
          case 'FAILED':
            return { label: 'Échoué', color: 'bg-red-500 hover:bg-red-600' };
          default:
            return { label: status, color: 'bg-gray-500 hover:bg-gray-600' };
        }
      
      case 'booking':
        switch (upperStatus) {
          case 'CONFIRMED':
            return { label: 'Confirmé', color: 'bg-green-500 hover:bg-green-600' };
          case 'PENDING':
            return { label: 'En attente', color: 'bg-yellow-500 hover:bg-yellow-600' };
          case 'CANCELLED':
            return { label: 'Annulé', color: 'bg-red-500 hover:bg-red-600' };
          case 'COMPLETED':
            return { label: 'Terminé', color: 'bg-blue-500 hover:bg-blue-600' };
          default:
            return { label: status, color: 'bg-gray-500 hover:bg-gray-600' };
        }
      
      default:
        return { label: status, color: 'bg-gray-500 hover:bg-gray-600' };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge className={cn(config.color, 'text-white', className)}>
      {config.label}
    </Badge>
  );
}
