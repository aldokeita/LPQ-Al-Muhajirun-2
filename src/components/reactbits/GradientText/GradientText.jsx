import React from 'react';
import './GradientText.css';

const GradientText = ({ children, className = '' }) => (
  <span className={`rb-gradient-text ${className}`}>{children}</span>
);

export default GradientText;
