import React from 'react';
import { Check, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const AttendanceStatusIcon = ({ status, onClick, className }) => {
  let Icon = Check;
  let colorClass = 'bg-emerald-500';

  if (status === 'Terlambat') {
    Icon = Clock;
    colorClass = 'bg-amber-500';
  } else if (status === 'Tidak Hadir' || status === 'A' || status === 'Alpha') {
    Icon = X;
    colorClass = 'bg-red-500';
  } else if (status === 'Hadir' || status === 'H') {
    Icon = Check;
    colorClass = 'bg-emerald-500';
  } else {
    // Default or undefined
    return <div className={cn("w-6 h-6 rounded-full bg-slate-200", className)} />;
  }

  return (
    <div 
      onClick={onClick}
      className={cn(
        "attendance-icon flex items-center justify-center w-6 h-6 rounded-full text-white cursor-pointer shadow-sm transition-all duration-200",
        colorClass,
        className
      )}
      title={status}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={3} />
    </div>
  );
};

export default AttendanceStatusIcon;