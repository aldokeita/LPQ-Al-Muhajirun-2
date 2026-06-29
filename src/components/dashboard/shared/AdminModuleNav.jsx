import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * AdminModuleNav — Premium horizontal pill-based module navigation.
 * Groups admin tabs into logical categories with subtle visual separators.
 * Supports scroll fade indicators for mobile/tablet overflow.
 *
 * Props:
 * - tabs: Array<{ value, label, icon, group }> — tab definitions with group key
 * - activeTab: string — current active tab value
 * - onTabChange: (tabValue: string) => void — tab change handler
 *
 * Groups: 'data', 'akademik', 'keuangan', 'konten', 'sistem'
 */

const GROUP_ORDER = ['data', 'akademik', 'keuangan', 'konten', 'sistem'];
const GROUP_LABELS = {
  data: 'Data',
  akademik: 'Akademik',
  keuangan: 'Keuangan',
  konten: 'Konten',
  sistem: 'Sistem',
};

const AdminModuleNav = ({ tabs, activeTab, onTabChange }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  // Scroll active tab into view on change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-value="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Group tabs
  const groupedTabs = React.useMemo(() => {
    const groups = {};
    tabs.forEach((tab) => {
      const group = tab.group || 'sistem';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tab);
    });
    return GROUP_ORDER
      .filter((g) => groups[g]?.length > 0)
      .map((g) => ({ key: g, label: GROUP_LABELS[g], items: groups[g] }));
  }, [tabs]);

  const handleKeyDown = (e, idx) => {
    const flatTabs = tabs;
    let nextIdx = idx;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIdx = (idx + 1) % flatTabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIdx = (idx - 1 + flatTabs.length) % flatTabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = flatTabs.length - 1;
    } else {
      return;
    }
    onTabChange(flatTabs[nextIdx].value);
  };

  // Build flat index for keyboard navigation
  let flatIdx = 0;

  return (
    <div className="admin-module-nav" role="tablist" aria-label="Navigasi modul admin">
      <div className="admin-nav-scroll-container">
        {/* Left fade indicator */}
        {canScrollLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, hsl(var(--admin-bg)), transparent)',
            }}
            aria-hidden="true"
          />
        )}
        {/* Right fade indicator */}
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, hsl(var(--admin-bg)), transparent)',
            }}
            aria-hidden="true"
          />
        )}

        <div
          ref={scrollRef}
          className="admin-nav-scroll flex items-center gap-1 overflow-x-auto px-2 md:px-0 py-1"
        >
          {groupedTabs.map((group, groupIdx) => (
            <React.Fragment key={group.key}>
              {groupIdx > 0 && (
                <div className="admin-nav-group-separator" aria-hidden="true" />
              )}
              <span className="admin-nav-group-label hidden md:inline" aria-hidden="true">
                {group.label}
              </span>
              {group.items.map((tab) => {
                const currentFlatIdx = flatIdx++;
                const isActive = activeTab === tab.value;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    data-tab-value={tab.value}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`admin-nav-pill ${isActive ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.value)}
                    onKeyDown={(e) => handleKeyDown(e, currentFlatIdx)}
                  >
                    {Icon && (
                      <Icon className="admin-nav-pill-icon" aria-hidden="true" />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminModuleNav;