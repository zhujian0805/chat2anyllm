import React, { useState } from 'react';
import { SessionSummary, RoleDef } from '../types';
import './SessionsSidebar.css';

interface Props {
  sessions: SessionSummary[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleteSession?: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  // Roles
  roles: RoleDef[];
  activeRoleId?: string | null;
  onSelectRole: (id: string | null) => void;
  onCreateRole: (name: string, instructions: string) => Promise<void>;
  onEditRole?: (role: RoleDef) => void;
  onDeleteRole?: (id: string) => void;
  onStartCreateRole?: () => void;
}

export const SessionsSidebar: React.FC<Props> = ({ sessions, activeId, onSelect, onNew, onDeleteSession, collapsed = false, onToggleCollapse, roles, activeRoleId, onSelectRole, onCreateRole, onEditRole, onDeleteRole, onStartCreateRole }) => {
  // Local toggles
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [rolesOpen, setRolesOpen] = useState(true);

  return (
    <aside className={`sessions-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button
          className="collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      {!collapsed && (
        <div className="menu-sections">
          {/* Sessions Section */}
          <div className="menu-section">
            <div className="section-header">
              <button
                className="section-toggle"
                onClick={() => setSessionsOpen(o => !o)}
                aria-expanded={sessionsOpen}
                aria-controls="sessions-list"
                title={sessionsOpen ? 'Hide sessions' : 'Show sessions'}
              >
                <span className="caret">{sessionsOpen ? '▾' : '▸'}</span>
                <h2>Sessions</h2>
              </button>
              {sessionsOpen && (
                <button className="new-session-btn" onClick={onNew}>+ New</button>
              )}
            </div>
            <div id="sessions-list" className={`sessions-list ${sessionsOpen ? '' : 'hidden'}`}>
              {sessions.length === 0 ? (
                <div className="empty">No sessions yet</div>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    className={`session-item-wrapper ${activeId === s.id ? 'active' : ''}`}
                  >
                    <button
                      className={`session-item ${activeId === s.id ? 'active' : ''}`}
                      onClick={() => onSelect(s.id)}
                      title={s.title}
                    >
                      <div className="title">{s.title}</div>
                      <div className="updated">{new Date(s.updated_at).toLocaleString()}</div>
                    </button>
                    {onDeleteSession && (
                      <button
                        className="mini-btn delete-btn"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (window.confirm(`Delete session "${s.title}"?`)) {
                            onDeleteSession(s.id);
                          }
                        }}
                        aria-label={`Delete session ${s.title}`}
                        title="Delete session"
                      >🗑️</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Roles Section */}
          <div className="menu-section">
            <div className="section-header">
              <button
                className="section-toggle"
                onClick={() => setRolesOpen(r => !r)}
                aria-expanded={rolesOpen}
                aria-controls="roles-list"
                title={rolesOpen ? 'Hide roles' : 'Show roles'}
              >
                <span className="caret">{rolesOpen ? '▾' : '▸'}</span>
                <h2>Roles</h2>
              </button>
              {rolesOpen && (
                <button
                  className="new-session-btn"
                  onClick={() => onStartCreateRole ? onStartCreateRole() : undefined}
                >+ New</button>
              )}
            </div>
            <div id="roles-list" className={`sessions-list ${rolesOpen ? '' : 'hidden'}`}>
              {roles.length === 0 ? (
                <div className="empty">No roles</div>
              ) : (
                roles.map(r => (
                  <div
                    key={r.id}
                    className={`session-item role-item ${activeRoleId === r.id ? 'active' : ''}`}
                    title={r.instructions}
                  >
                    <div className="item-main" onClick={() => onSelectRole(activeRoleId === r.id ? null : r.id)}>
                      <div className="title">{r.name}</div>
                      <div className="updated">{new Date(r.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div className="role-actions">
                      {onEditRole && (
                        <button
                          className="mini-btn edit-role-btn"
                          onClick={(e) => { e.stopPropagation(); onEditRole(r); }}
                          aria-label={`Edit role ${r.name}`}
                          title="Edit role instructions"
                        >✎</button>
                      )}
                      {onDeleteRole && (
                        <button
                          className="mini-btn delete-btn"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (window.confirm(`Delete role "${r.name}"?`)) {
                              onDeleteRole(r.id);
                            }
                          }}
                          aria-label={`Delete role ${r.name}`}
                          title="Delete role"
                        >🗑️</button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {activeRoleId && (
                <button
                  className="session-item"
                  onClick={() => onSelectRole(null)}
                  title="Clear active role"
                >Clear Role</button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
