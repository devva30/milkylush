import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Search, X } from 'lucide-react';
import logoImg from '../assets/logo.png';

export interface NavItem {
  id: string;
  label: string;
  icon: any;
}

export interface NavGroup {
  /** Shown as a heading. A group with no title is the always-open "daily" block. */
  title?: string;
  /** Collapsible groups fold away until needed; the group holding the open page stays open. */
  collapsible?: boolean;
  items: NavItem[];
}

interface SideNavProps {
  groups: NavGroup[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onLogout?: () => void;
  /** Shown as the last item, e.g. "Back to portals". */
  exit?: { label: string; icon: any; onClick: () => void };
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  /** Pass both to let the menu shrink to icons. */
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Small line under the logo, e.g. which console this is. */
  consoleName?: string;
}

export default function SideNav({
  groups,
  activeTab,
  onSelectTab,
  onLogout,
  exit,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
  consoleName,
}: SideNavProps) {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const groupHolding = (id: string) => groups.findIndex((g) => g.items.some((i) => i.id === id));
  const [open, setOpen] = useState<Set<number>>(() => new Set([groupHolding(activeTab)]));

  // Opening a page from somewhere else (a link, the bell) opens its group too.
  useEffect(() => {
    const idx = groupHolding(activeTab);
    if (idx >= 0) setOpen((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggle = (idx: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((group, idx) => ({
        group,
        idx,
        items: q ? group.items.filter((i) => i.label.toLowerCase().includes(q)) : group.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const go = (id: string) => {
    onSelectTab(id);
    setQuery('');
    onCloseMobile?.();
  };

  const width = isCollapsed ? '72px' : '264px';

  const button = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.id)}
        title={isCollapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`sidenav-item ${active ? 'active' : ''}`}
      >
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
        {!isCollapsed && <span>{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {isMobileOpen && <div className="sidebar-mobile-backdrop" onClick={onCloseMobile} />}
      <aside className={`sidebar-container sidenav ${isMobileOpen ? 'mobile-open' : ''}`} style={{ width }}>
        <div className="sidenav-brand">
          <img src={logoImg} alt="MilkyLush" style={{ height: isCollapsed ? '28px' : '38px', maxWidth: isCollapsed ? '44px' : '170px', objectFit: 'contain' }} />
          {!isCollapsed && consoleName && <div className="sidenav-console">{consoleName}</div>}
        </div>

        {!isCollapsed && (
          <div className="sidenav-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Find a page…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find a page"
            />
            {searching && (
              <button type="button" aria-label="Clear" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <nav className="sidenav-groups">
          {visible.map(({ group, idx, items }) => {
            const folded = Boolean(group.collapsible) && !searching && !open.has(idx) && !isCollapsed;
            const hasActive = group.items.some((i) => i.id === activeTab);
            return (
              <div key={idx} className="sidenav-group">
                {group.title && !isCollapsed &&
                  (group.collapsible ? (
                    <button type="button" className={`sidenav-heading clickable ${hasActive ? 'has-active' : ''}`} onClick={() => toggle(idx)} aria-expanded={!folded}>
                      <span>{group.title}</span>
                      <ChevronDown size={14} style={{ transform: folded ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  ) : (
                    <div className="sidenav-heading">{group.title}</div>
                  ))}
                {isCollapsed && group.title && idx > 0 && <div className="sidenav-divider" />}
                {!folded && <div className="sidenav-items">{items.map(button)}</div>}
              </div>
            );
          })}
          {searching && visible.length === 0 && <div className="sidenav-empty">No page called “{query}”.</div>}
        </nav>

        <div className="sidenav-footer">
          {exit && (
            <button type="button" className="sidenav-item" onClick={() => { exit.onClick(); onCloseMobile?.(); }} title={isCollapsed ? exit.label : undefined}>
              <exit.icon size={18} />
              {!isCollapsed && <span>{exit.label}</span>}
            </button>
          )}
          {onLogout && (
            <button type="button" className="sidenav-item danger" onClick={onLogout} title={isCollapsed ? 'Log out' : undefined}>
              <LogOut size={18} />
              {!isCollapsed && <span>Log out</span>}
            </button>
          )}
          {onToggleCollapse && (
            <button type="button" className="sidenav-item muted" onClick={onToggleCollapse} title={isCollapsed ? 'Expand menu' : 'Collapse menu'}>
              {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              {!isCollapsed && <span>Collapse menu</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
