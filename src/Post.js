import React from 'react';

/**
 * Post - Presentational component for a single post
 * props:
 *  - post: { id, content, createdAt }
 *  - onDelete: optional function(id)
 */
export default function Post({ post, onDelete }) {
  const { title, id, content, createdAt } = post;
  const date = new Date(createdAt);

  return (
    <article className="post" style={{ border: '1px solid #ddd', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: 6, backgroundColor: 'white'}}>
      {title ? (
        <h3 className="post-title" style={{ margin: 0, marginBottom: 6, fontSize: '1.05rem', fontWeight: 600 }}>{title}</h3>
      ) : null}
      <div className="post-content" style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
      <div className="post-meta" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <small style={{ color: '#666' }}>{date.toLocaleString()}</small>
        {onDelete ? (
          <button onClick={() => onDelete(id)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
