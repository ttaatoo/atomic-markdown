import type { OutlineNode } from './outline';

export function OutlinePanel(props: {
  nodes: OutlineNode[];
  activeFrom?: number;
  overlay?: boolean;
  collapsed?: boolean;
  collapsedFroms?: ReadonlySet<number>;
  onSelect: (from: number) => void;
  onToggleSidebar: () => void;
  onToggleNode: (from: number) => void;
}) {
  if (props.collapsed) {
    return (
      <nav className="outline-panel outline-panel-collapsed" aria-label="Document outline">
        <button
          type="button"
          className="outline-icon-btn"
          aria-label="Show outline"
          title="Show outline"
          onClick={props.onToggleSidebar}
        >
          <OutlineGlyph />
        </button>
      </nav>
    );
  }

  return (
    <nav
      className={`outline-panel${props.overlay ? ' outline-panel-overlay' : ''}`}
      aria-label="Document outline"
    >
      <div className="outline-panel-head">
        <div className="outline-panel-title">Outline</div>
        <button
          type="button"
          className="outline-icon-btn outline-icon-btn-inline"
          aria-label="Hide outline"
          title="Hide outline"
          onClick={props.onToggleSidebar}
        >
          <CollapseGlyph />
        </button>
      </div>
      {props.nodes.length === 0 ? (
        <p className="outline-empty">No headings yet. Add a # heading to see it here.</p>
      ) : (
        <OutlineList
          nodes={props.nodes}
          activeFrom={props.activeFrom}
          collapsedFroms={props.collapsedFroms ?? new Set()}
          onSelect={props.onSelect}
          onToggleNode={props.onToggleNode}
        />
      )}
    </nav>
  );
}

function OutlineList(props: {
  nodes: OutlineNode[];
  activeFrom?: number;
  collapsedFroms: ReadonlySet<number>;
  onSelect: (from: number) => void;
  onToggleNode: (from: number) => void;
}) {
  return (
    <ul className="outline-list">
      {props.nodes.map((node) => {
        const current = props.activeFrom === node.from;
        const hasChildren = node.children.length > 0;
        const expanded = hasChildren && !props.collapsedFroms.has(node.from);
        return (
          <li key={`${node.from}:${node.level}:${node.text}`}>
            <div className={`outline-row outline-level-${node.level}`}>
              {hasChildren ? (
                <button
                  type="button"
                  className={`outline-twisty${expanded ? ' outline-twisty-open' : ''}`}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Collapse ${node.text}` : `Expand ${node.text}`}
                  onClick={() => props.onToggleNode(node.from)}
                />
              ) : (
                <span className="outline-twisty-spacer" aria-hidden="true" />
              )}
              <button
                type="button"
                className={`outline-item${current ? ' outline-item-active' : ''}`}
                aria-current={current ? 'location' : undefined}
                onClick={() => props.onSelect(node.from)}
              >
                {node.text}
              </button>
            </div>
            {hasChildren && expanded ? (
              <OutlineList
                nodes={node.children}
                activeFrom={props.activeFrom}
                collapsedFroms={props.collapsedFroms}
                onSelect={props.onSelect}
                onToggleNode={props.onToggleNode}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function OutlineGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h7" />
    </svg>
  );
}

function CollapseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}
