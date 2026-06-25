import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './MagicBento.css';

const MagicBento = ({ items = [] }) => {
  const gridRef = useRef(null);

  const handlePointerMove = (event) => {
    const card = event.target.closest('.rb-magic-bento__card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  };

  return (
    <div className="rb-magic-bento" ref={gridRef} onPointerMove={handlePointerMove}>
      {items.map((item, index) => (
        <Link
          key={item.id || item.title}
          to={item.route || '/profil'}
          className={`rb-magic-bento__card ${item.featured ? 'is-featured' : ''} tone-${index % 4}`}
        >
          <span className="rb-magic-bento__eyebrow">{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <p>{item.description}</p>
          <span className="rb-magic-bento__cta">
            Buka informasi <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ))}
    </div>
  );
};

export default MagicBento;
