import React, { useEffect, useState } from 'react';
import Post from './Post';

const STORAGE_KEY = 'community_posts_v1';

export default function Homepage() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPosts(JSON.parse(raw));
    } catch (err) {
      // ignore
      console.error('Failed to read posts from storage', err);
    }
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (err) {
      console.error('Failed to save posts', err);
    }
  }, [posts]);

  function handleCreate(e) {
    e && e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const newPost = {
      title: title,
      id: Date.now().toString(),
      content: trimmed,
      createdAt: Date.now(),
    };
    fetch('http://localhost:2900/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: newPost.id,
            comments: [],
            likes: 0,
            title: newPost.title,
            body: newPost.content,
            createdAt: newPost.createdAt,
        }),
    }).then(res => {
        if (!res.ok) {
            console.error('Failed to create post on server', res.status, res.statusText);
        }
    }).catch(err => {
        console.error('Network error creating post', err);
    });
    setPosts(prev => [newPost, ...prev]);
    setText('');
    setTitle('')
  }

  function handleDelete(id) {
    setPosts(prev => prev.filter(p => p.id !== id));
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
          posts.map(p => <Post key={p.id} post={p} onDelete={handleDelete} />)
        )}
      </section>
    </div>
  );
}
