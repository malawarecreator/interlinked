import React, { useEffect, useState } from 'react';
import Post from './Post';
import AddPostModal from './AddPostModal';
import FloatingActionButton from './FloatingActionButton';

const STORAGE_KEY = 'community_posts_v1';

export default function Homepage() {
  const [posts, setPosts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // load from localStorage
  useEffect(() => {
    fetch('http://localhost:8000/api/getAllPosts', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json()).then(data => {
      setPosts(Array.isArray(data) ? data : []);
    }).catch(err => console.error('Network error getting posts', err));
  }, []);
// persist

  function handleCreate(title, content) {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    const newPost = {
      title: title,
      id: Date.now().toString(),
      body: trimmedContent,
      created_at: Date.now(),
      likes: 0,
    };

    // Send to backend
    fetch('http://localhost:8000/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          created_at: newPost.created_at,
          title: newPost.title,
          body: newPost.body,
          id: newPost.id,
          likes: newPost.likes,
        }),
    }).then(res => {
        if (!res.ok) {
            console.error('Failed to create post on server', res.status, res.statusText);
        }
    }).catch(err => {
        console.error('Network error creating post', err);
    });

    setPosts(prev => [newPost, ...prev]);
  }

  function handleDelete(id) {
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  // Mock alerts data - in a real app this would come from an API
  const alerts = [
    { id: 1, type: 'info', message: 'Welcome to Interlinked! Connect with your community.', time: '2 hours ago' },
    { id: 2, type: 'success', message: 'Your post "Community Event" received 5 likes!', time: '1 hour ago' },
    { id: 3, type: 'warning', message: 'Remember to follow community guidelines.', time: '30 min ago' },
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
            Interlinked Dashboard
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
              Local Alerts
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
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} in your community
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
                  {posts.map(p => <Post key={p.id} post={p} onDelete={handleDelete} />)}
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
        onSubmit={handleCreate}
      />
    </div>
  );
}
