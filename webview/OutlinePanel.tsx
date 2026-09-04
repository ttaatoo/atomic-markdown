import type { OutlineNode } from './outline';

export function OutlinePanel(props: {
  nodes: OutlineNode[];
  activeFrom?: number;
  onSelect: (from: number) => void;
}) {
  return (
    <nav className="outline-panel" aria-label="Document outline">
      <div className="outline-panel-title">Outline</div>
      {props.nodes.length === 0 ? (
        <p className="outline-empty">No headings in this document.</p>
      ) : (
        <OutlineList nodes={props.nodes} activeFrom={props.activeFrom} onSelect={props.onSelect} />
      )}
    </nav>
  );
}

function OutlineList(props: {
  nodes: OutlineNode[];
  activeFrom?: number;
  onSelect: (from: number) => void;
}) {
  return (
    <ul className="outline-list">
      {props.nodes.map((node) => {
        const current = props.activeFrom === node.from;
        return (
          <li key={`${node.from}:${node.level}:${node.text}`}>
            <button
              type="button"
              className={`outline-item outline-level-${node.level}${current ? ' outline-item-active' : ''}`}
              aria-current={current ? 'location' : undefined}
              onClick={() => props.onSelect(node.from)}
            >
              {node.text}
            </button>
            {node.children.length > 0 ? (
              <OutlineList nodes={node.children} activeFrom={props.activeFrom} onSelect={props.onSelect} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
