import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './SplitText.css';

const SplitText = ({ text, as: Tag = 'span', className = '', children }) => {
  const reducedMotion = useReducedMotion();
  const content = children || text;
  const words = String(text || '').split(' ').filter(Boolean);

  if (children || reducedMotion || words.length === 0) {
    return <Tag className={className}>{content}</Tag>;
  }

  return (
    <Tag className={`rb-split-text ${className}`} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          aria-hidden="true"
          className="rb-split-word"
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 26, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.58, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
};

export default SplitText;
