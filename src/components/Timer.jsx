import React, { useState, useEffect } from 'react';
import Icon from './Icon';

const Timer = ({ initialMinutes, onTimeUp }) => {
  const [seconds, setSeconds] = useState((initialMinutes || 0) * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeUp]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-[18px] font-bold text-white shadow-sm ${seconds < 300 ? 'bg-rose-500 animate-pulse' : 'bg-slate-800'}`}>
      <Icon name="clock" size={18} /> {m}:{s.toString().padStart(2, '0')}
    </div>
  );
};

export default Timer;
