import React from 'react';

/**
 * AdminPageHeader — Consistent page header for admin dashboard sections.
 * Renders title, subtitle, and optional action buttons.
 * Uses admin design tokens from admin-dashboard.css.
 */
const AdminPageHeader = ({ eyebrow, title, subtitle, actions, children }) => {
  return (
    <header className="admin-page-header mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div className="admin-page-header__copy">
        {eyebrow && <p className="admin-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="admin-page-header__title text-2xl md:text-3xl lg:text-4xl font-bold mb-1.5">
          {title}
        </h1>
        {subtitle && (
          <p className="admin-page-header__subtitle text-sm md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div className="admin-page-header__actions flex flex-wrap gap-2 items-center">
          {actions || children}
        </div>
      )}
    </header>
  );
};

export default AdminPageHeader;
