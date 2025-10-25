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
    <article className="card" style={{
      padding: '1.5rem',
      borderRadius: 'var(--border-radius)',
    }}>
      {title && (
        <h3 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3
        }}>
          {title}
        </h3>
      )}

      <div style={{
        whiteSpace: 'pre-wrap',
        color: 'var(--text-primary)',
        marginBottom: '1.5rem',
        lineHeight: 1.6,
        fontSize: '1rem'
      }}>
        {content}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-color)',
        gap: '1rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-muted)'
        }}>
          <span>📅</span>
          <span>{isValidDate ? relativeTime : 'Unknown'}</span>
        </div>

        <div className="post-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => onLike && onLike(id)}
            disabled={liking}
            className={`btn ${liked ? 'btn-danger' : 'btn-success'}`}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              minWidth: 'auto',
              transform: liked ? 'scale(1.05)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {liking ? '⏳ Liking…' : `👍 Like (${likes})`}
          </button>

          <button
            onClick={() => setShowComments(s => !s)}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              minWidth: 'auto'
            }}
          >
            💬 {showComments ? `Hide comments (${localComments.length})` : `Comments (${localComments.length})`}
          </button>
        </div>
      </div>

      {showComments && (
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          <form onSubmit={handleSubmitComment} className="comment-form" style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            alignItems: 'flex-end'
          }}>
            <div style={{ flex: 1 }}>
              <input
                className="input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                disabled={commenting}
                style={{ marginBottom: 0 }}
              />
            </div>
            <button
              type="submit"
              disabled={commenting}
              className="btn btn-primary"
              style={{
                padding: '12px 20px',
                whiteSpace: 'nowrap'
              }}
            >
              {commenting ? '⏳ Posting…' : '💬 Post'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {localComments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--border-radius)',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💭</div>
                <div>No comments yet</div>
              </div>
            ) : (
              localComments.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.background = 'var(--bg-tertiary)'}
                >
                  <div style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    lineHeight: 1.5
                  }}>
                    {c.body}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span>📅</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
