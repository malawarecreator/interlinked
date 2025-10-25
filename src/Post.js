import React, { useState, useEffect } from 'react';

/**
 * Post - Presentational component for a single post
 * props:
 *  - post: { id, content|body, createdAt|created_at, title, likes }
 *  - onLike: optional function(id)
 */
export default function Post({ post, onLike, liking = false, liked = false, comments = [], onLoadComments, onSubmitComment }) {
  const title = post.title;
  const id = post.id;
  const content = post.content ?? post.body ?? '';
  const rawTimestamp = post.createdAt ?? post.created_at;
  const likes = post.likes ?? 0;

  // Normalize timestamp to Date
  const getValidDate = (timestamp) => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      if (!isNaN(parsed)) return new Date(parsed);
      const asInt = parseInt(timestamp, 10);
      if (!isNaN(asInt)) return new Date(asInt < 100000000000 ? asInt * 1000 : asInt);
      return new Date();
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
    }
    return new Date(timestamp);
  };

  const date = getValidDate(rawTimestamp);
  const isValidDate = !isNaN(date.getTime());

  const getRelativeTime = (date) => {
    if (!isValidDate) return 'Just now';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} week${Math.floor(diffInSeconds / 604800) !== 1 ? 's' : ''} ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} month${Math.floor(diffInSeconds / 2592000) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 31536000)} year${Math.floor(diffInSeconds / 31536000) !== 1 ? 's' : ''} ago`;
  };

  const relativeTime = getRelativeTime(date);

  // Comments UI (can be driven by parent via props + handlers)
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  // local comments state so we can show results immediately even if parent hasn't updated props yet
  const [localComments, setLocalComments] = useState(comments || []);

  // keep localComments in sync when parent updates the comments prop
  useEffect(() => {
    setLocalComments(comments || []);
  }, [comments]);

  useEffect(() => {
    // If comments panel opened and parent provided onLoadComments, ask parent to load and use returned value
    if (showComments && onLoadComments) {
      // call and use returned array to populate immediately
      onLoadComments(id).then(result => {
        if (Array.isArray(result)) setLocalComments(result);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments]);

  async function handleSubmitComment(e) {
    e && e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    setCommenting(true);
    try {
      if (onSubmitComment) {
        const added = await onSubmitComment(id, text);
        // update localComments with the returned/created comment
        if (added) setLocalComments(prev => [added, ...prev]);
      } else {
        // fallback to direct API call if parent didn't provide handler
        const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
        const payload = { created_at: new Date().toISOString(), body: text, linked_post: id };
        await fetch(`${API_BASE}/createComment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        setLocalComments(prev => [{ body: text, created_at: payload.created_at }, ...prev]);
      }
      setCommentText('');
    } catch (err) {
      console.error('Failed to submit comment', err);
    } finally {
      setCommenting(false);
    }
  }

  return (
    <article className="post" style={{
      border: '1px solid #e5e7eb',
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: 'white',
    }}>
      {title ? (
        <h3 style={{ margin: 0, marginBottom: 6, fontSize: '1.05rem', fontWeight: 600 }}>{title}</h3>
      ) : null}

      <div style={{ whiteSpace: 'pre-wrap', color: '#374151', marginBottom: 8 }}>{content}</div>

      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <small style={{ color: '#666' }}>{isValidDate ? date.toLocaleString() : 'Unknown'}</small>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => onLike && onLike(id)}
            disabled={liking}
            style={{
              background: liked ? '#ef4444' : '#10b981',
              color: '#fff',
              border: 'none',
              padding: '6px 8px',
              borderRadius: 4,
              cursor: liking ? 'not-allowed' : 'pointer',
              opacity: liking ? 0.6 : 1,
              transform: liked ? 'scale(1.02)' : 'none',
              transition: 'transform 120ms ease, opacity 120ms ease',
            }}
          >
            {liking ? 'Liking…' : `Like (${likes})`}
          </button>

          <button
            onClick={() => setShowComments(s => !s)}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}
          >
            {showComments ? `Hide comments (${localComments.length})` : `Comments (${localComments.length})`}
          </button>
        </div>
      </div>

      {showComments && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}
              disabled={commenting}
            />
            <button type="submit" disabled={commenting} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#0366d6', color: '#fff' }}>{commenting ? 'Posting…' : 'Post'}</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localComments.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>No comments yet</div>
            ) : (
              localComments.map((c, idx) => (
                <div key={idx} style={{ padding: 8, background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.9rem', color: '#374151' }}>{c.body}</div>
                  <small style={{ color: '#9ca3af' }}>{new Date(c.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
