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
    <div className="homepage" style={{ maxWidth: 800, margin: '0 auto', backgroundColor: 'lightblue' }}>
      <div style={{fontFamily: "comic-sans"}}>
        <h2>Interlinked</h2>
        <h4>Connecting Millions of Communities Around the World</h4>
      </div>

      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title..." style={{ width: '100%', padding: 8  , borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }}/>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Share something anonymously..."
          rows={4}
          style={{ width: '100%', padding: 8  , borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#0366d6', color: '#fff', cursor: 'pointer' }}>Post</button>
          <button type="button" onClick={() => setText('')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Clear</button>
        </div>
      </form>

      <section className="posts">
        {posts.length === 0 ? (
          <p>No posts yet — be the first!</p>
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
