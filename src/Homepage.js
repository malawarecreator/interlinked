import React, { useEffect, useState } from 'react';
import Post from './Post';
import AddPostModal from './AddPostModal';
import FloatingActionButton from './FloatingActionButton';

// Backend API base (change via env var if needed)
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
const STORAGE_KEY = 'community_posts_v1';

export default function Homepage() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [likingIds, setLikingIds] = useState([]);
  const [likedIds, setLikedIds] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock alerts data - in a real app this would come from an API
  const alerts = [
    { id: 1, type: 'info', message: 'Welcome to Interlinked! Connect with your community anonymously.', time: '2 hours ago' },
    { id: 2, type: 'success', message: `Your community now has ${posts.length} posts!`, time: '1 hour ago' },
    { id: 3, type: 'warning', message: 'Remember to follow community guidelines when posting.', time: '30 min ago' },
  ];

  const getAlertIcon = (type) => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  // Load posts from backend on mount. If backend is unreachable, fall back to localStorage.
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/getAllPosts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // backend returns array of { created_at, title, body, id, likes }
        const mapped = data.map(p => ({
          id: p.id,
          title: p.title,
          content: p.body,
          createdAt: p.created_at,
          likes: p.likes ?? 0,
        }));
        if (mounted) {
          const ordered = mapped.reverse(); // show newest first if backend returns oldest-first
          setPosts(ordered);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered)); } catch {};

          // Preload comments for posts so they persist across refreshes.
          try {
            const commentsResults = await Promise.all(ordered.map(async (p) => {
              try {
                const cres = await fetch(`${API_BASE}/getCommentsForPost?linked_post=${encodeURIComponent(p.id)}`);
                if (!cres.ok) return { id: p.id, comments: [] };
                const cdata = await cres.json();
                const mappedComments = cdata.map(c => ({ body: c.body, created_at: c.created_at })).reverse();
                return { id: p.id, comments: mappedComments };
              } catch (e) {
                return { id: p.id, comments: [] };
              }
            }));
            const newComments = {};
            commentsResults.forEach(r => { newComments[r.id] = r.comments; });
            if (mounted) setCommentsByPost(prev => ({ ...prev, ...newComments }));
          } catch (e) {
            console.warn('Failed to preload comments', e);
          }
        }
      } catch (err) {
        console.warn('Failed to load posts from API, falling back to localStorage', err);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw && mounted) setPosts(JSON.parse(raw));
        } catch (e) {
          console.error('Failed reading from localStorage', e);
        }
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  // persist to localStorage as a fallback/cache
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch (err) { /* ignore */ }
  }, [posts]);

  async function handleCreate(eOrTitle, maybeContent) {
    if (eOrTitle && typeof eOrTitle.preventDefault === 'function') {
      eOrTitle.preventDefault();
    }

    const submittedTitle = typeof eOrTitle === 'string' ? eOrTitle : title;
    const submittedContent = typeof eOrTitle === 'string' ? maybeContent : text;
    const trimmed = (submittedContent ?? '').trim();
    if (!trimmed) return;

    const sanitizedTitle = (submittedTitle ?? '').trim();

    const newPostPayload = {
      created_at: new Date().toISOString(),
      title: sanitizedTitle,
      body: trimmed,
      id: Date.now().toString(),
      likes: 0,
    };

    try {
      const res = await fetch(`${API_BASE}/createPost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPostPayload),
      });

      if (!res.ok) {
        console.error('Failed to create post on server', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Network error creating post', err);
    }

    // Update UI optimistically
    const newPost = {
      id: newPostPayload.id,
      title: newPostPayload.title,
      content: newPostPayload.body,
      createdAt: newPostPayload.created_at,
      likes: 0,
    };
    setPosts(prev => [newPost, ...prev]);
    setText('');
    setTitle('');
  }


  async function handleLike(id) {
    // prevent duplicate requests for same post
    if (likingIds.includes(id)) return;
    setLikingIds(prev => [...prev, id]);

    try {
      // backend expects POST with query param `id`
      const res = await fetch(`${API_BASE}/like?id=${encodeURIComponent(id)}`, { method: 'POST' });
      if (!res.ok) {
        console.error('Failed to like post', res.status, res.statusText);
        setLikingIds(prev => prev.filter(x => x !== id));
        return;
      }

      // fetch authoritative post data from server (so likes reflect DB)
      const getRes = await fetch(`${API_BASE}/getPost?id=${encodeURIComponent(id)}`);
      if (getRes.ok) {
        const p = await getRes.json();
        const mapped = {
          id: p.id,
          title: p.title,
          content: p.body,
          createdAt: p.created_at,
          likes: p.likes ?? 0,
        };
        setPosts(prev => prev.map(item => item.id === id ? mapped : item));
        // mark as liked briefly for visual feedback
        setLikedIds(prev => [...prev, id]);
        setTimeout(() => setLikedIds(prev => prev.filter(x => x !== id)), 1500);
      } else {
        // fallback: increment locally
        setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: (p.likes ?? 0) + 1 } : p));
        setLikedIds(prev => [...prev, id]);
        setTimeout(() => setLikedIds(prev => prev.filter(x => x !== id)), 1500);
      }
    } catch (err) {
      console.error('Network error liking post', err);
    } finally {
      setLikingIds(prev => prev.filter(x => x !== id));
    }
  }

  // Load comments for a single post (used by Post components)
  async function loadCommentsForPost(id) {
    try {
      const res = await fetch(`${API_BASE}/getCommentsForPost?linked_post=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = data.map(c => ({ body: c.body, created_at: c.created_at }));
      // newest first
      setCommentsByPost(prev => ({ ...prev, [id]: mapped.reverse() }));
      return mapped.reverse();
    } catch (err) {
      console.warn('Failed to load comments for post', id, err);
      return [];
    }
  }

  // Submit a comment for a post (used by Post components)
  async function submitCommentOnPost(id, text) {
    const payload = {
      created_at: new Date().toISOString(),
      body: text,
      linked_post: id,
    };
    try {
      const res = await fetch(`${API_BASE}/createComment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // optimistic update in central store
      setCommentsByPost(prev => {
        const prevList = prev[id] || [];
        return { ...prev, [id]: [{ body: text, created_at: payload.created_at }, ...prevList] };
      });
      return { body: text, created_at: payload.created_at };
    } catch (err) {
      console.error('Failed to submit comment for post', id, err);
      throw err;
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{
            margin: 0,
            color: '#1f2937',
            fontSize: '1.875rem',
            fontWeight: '700',
          }}>
            <span className="gradient-text">Interlinked</span> Dashboard
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}>
            Connecting Communities Around the World
          </p>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div style={{
        display: 'flex',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        gap: '24px',
      }}>
        {/* Sidebar - Alerts */}
        <aside style={{
          width: '320px',
          flexShrink: 0,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
            }}>
              Community Alerts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map(alert => (
                <div key={alert.id} style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{
                      color: getAlertColor(alert.type),
                      fontSize: '1.125rem',
                      lineHeight: '1',
                    }}>
                      {getAlertIcon(alert.type)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: '#374151',
                        lineHeight: '1.4',
                      }}>
                        {alert.message}
                      </p>
                      <small style={{
                        color: '#9ca3af',
                        fontSize: '0.75rem',
                      }}>
                        {alert.time}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content - Posts */}
        <main style={{ flex: 1 }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{
                margin: '0 0 8px 0',
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1f2937',
              }}>
                Community Posts
              </h2>
              <p style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '0.875rem',
              }}>
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} shared anonymously
              </p>
            </div>

            <section className="posts">
              {posts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  color: '#6b7280',
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No posts yet</h3>
                  <p style={{ margin: 0 }}>Be the first to share something with your community!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {posts.map(p => <Post
                    key={p.id}
                    post={p}
                    onLike={handleLike}
                    liking={likingIds.includes(p.id)}
                    liked={likedIds.includes(p.id)}
                    onLoadComments={loadCommentsForPost}
                    onSubmitComment={submitCommentOnPost}
                    comments={commentsByPost[p.id] || []}
                  />)}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => setIsModalOpen(true)} />

      {/* Modal */}
      <AddPostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(modalTitle, modalContent) => handleCreate(modalTitle, modalContent)}
      />
    </div>
  );
}
