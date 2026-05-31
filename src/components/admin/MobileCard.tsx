import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
}

const MobileCard = ({ children, onClick }: MobileCardProps) => {
  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer active:bg-muted/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      {children}
    </Card>
  );
};

export default MobileCard;
