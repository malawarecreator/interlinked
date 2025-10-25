import React from 'react';

/**
 * Post - Presentational component for a single post
 * props:
 *  - post: { id, body, created_at, title, likes }
 *  - onDelete: optional function(id)
 */
export default function Post({ post, onDelete }) {
  const { title, id, body, created_at } = post;

  // Handle different timestamp formats and invalid dates
  const getValidDate = (timestamp) => {
    if (!timestamp) return new Date();

    // Handle string timestamps
    if (typeof timestamp === 'string') {
      const parsed = parseInt(timestamp);
      if (!isNaN(parsed)) {
        // Convert seconds to milliseconds if needed (timestamps before 1971 are likely in seconds)
        return new Date(parsed < 100000000000 ? parsed * 1000 : parsed);
      }
      return new Date(timestamp);
    }

    // Handle numeric timestamps
    if (typeof timestamp === 'number') {
      // Convert seconds to milliseconds if needed
      return new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp);
    }

    return new Date(timestamp);
  };

  const date = getValidDate(created_at);
  const isValidDate = !isNaN(date.getTime());

  // Calculate relative time
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

  return (
    <article className="post" style={{
      border: '1px solid #e5e7eb',
      padding: '20px',
      borderRadius: '12px',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'box-shadow 0.2s ease-in-out',
    }}
    onMouseOver={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'}
    onMouseOut={(e) => e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'}
    >
      {title && (
        <h3 className="post-title" style={{
          margin: '0 0 12px 0',
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#1f2937',
          lineHeight: '1.4',
        }}>
          {title}
        </h3>
      )}
      <div className="post-content" style={{
        whiteSpace: 'pre-wrap',
        color: '#374151',
        lineHeight: '1.6',
        marginBottom: '16px',
        fontSize: '0.95rem',
      }}>
        {body}
      </div>
      <div className="post-meta" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
          }}></div>
          <small
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              fontWeight: '500',
            }}
            title={isValidDate ? `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}` : 'Unknown time'}
          >
            {relativeTime}
          </small>
        </div>
      </div>
    </article>
  );
}
