import React, { useEffect, useState } from 'react';
import Post from './Post';

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

  async function handleCreate(e) {
    e && e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const newPostPayload = {
      created_at: new Date().toISOString(),
      title: title,
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
    <div className="homepage" style={{
      maxWidth: 900,
      margin: '0 auto',
      width: '100%'
    }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '3rem',
        padding: '2rem 1rem'
      }}>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          fontWeight: 700,
          margin: '0 0 0.5rem 0',
          letterSpacing: '-0.02em'
        }}>
          <span className="gradient-text">Interlinked</span>
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: 'var(--text-secondary)',
          fontWeight: 400,
          margin: 0,
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: 1.5
        }}>
          Connecting millions of communities around the world through anonymous sharing
        </p>
        <div style={{
          width: '80px',
          height: '4px',
          background: 'var(--primary-gradient)',
          borderRadius: '2px',
          margin: '2rem auto 0'
        }}></div>
      </header>

      <div className="card" style={{
        padding: 'clamp(1rem, 4vw, 2rem)',
        marginBottom: '2rem'
      }}>
        <h3 style={{
          margin: '0 0 1.5rem 0',
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          Share your thoughts
        </h3>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give your post a title..."
              style={{ marginBottom: '0.5rem' }}
            />
          </div>

          <div>
            <textarea
              className="input textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Share something anonymously..."
              rows={4}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setText(''); setTitle(''); }}>
              Clear
            </button>
            <button type="submit" className="btn btn-primary">
              📝 Post
            </button>
          </div>
        </form>
      </div>

      <section className="posts" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {posts.length === 0 ? (
          <div className="card" style={{
            padding: 'clamp(2rem, 8vw, 3rem)',
            textAlign: 'center',
            background: 'var(--bg-tertiary)',
            border: '2px dashed var(--border-color)'
          }}>
            <div style={{
              fontSize: 'clamp(2rem, 8vw, 3rem)',
              marginBottom: '1rem'
            }}>💭</div>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              color: 'var(--text-secondary)',
              fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'
            }}>No posts yet</h3>
            <p style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 'clamp(0.9rem, 2vw, 1rem)'
            }}>Be the first to share your thoughts!</p>
          </div>
        ) : (
          posts.map(p => <Post
            key={p.id}
            post={p}
            onLike={handleLike}
            liking={likingIds.includes(p.id)}
            liked={likedIds.includes(p.id)}
            onLoadComments={loadCommentsForPost}
            onSubmitComment={submitCommentOnPost}
            comments={commentsByPost[p.id] || []}
          />)
        )}
      </section>
    </div>
  );
}
