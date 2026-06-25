import React from 'react';
import './BorderGlow.css';

const BorderGlow = ({ children, color = 'emerald', className = '' }) => (
  <div className={`rb-border-glow rb-border-glow--${color} ${className}`}>
    {children}
  </div>
);

export default BorderGlow;
