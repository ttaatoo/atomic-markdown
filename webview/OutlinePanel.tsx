import type { OutlineNode } from './outline';

export function OutlinePanel(props: {
  nodes: OutlineNode[];
  onSelect: (from: number) => void;
}) {
  return (
    <nav className="outline-panel" aria-label="Document outline">
      <div className="outline-panel-title">Outline</div>
      {props.nodes.length === 0 ? (
        <p className="outline-empty">No headings in this document.</p>
      ) : (
        <OutlineList nodes={props.nodes} onSelect={props.onSelect} />
      )}
    </nav>
  );
}

function OutlineList(props: { nodes: OutlineNode[]; onSelect: (from: number) => void }) {
  return (
    <ul className="outline-list">
      {props.nodes.map((node) => (
        <li key={`${node.from}:${node.level}:${node.text}`}>
          <button
            type="button"
            className={`outline-item outline-level-${node.level}`}
            onClick={() => props.onSelect(node.from)}
          >
            {node.text}
          </button>
          {node.children.length > 0 ? (
            <OutlineList nodes={node.children} onSelect={props.onSelect} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
