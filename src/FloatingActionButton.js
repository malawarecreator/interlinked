import React from 'react';

export default function FloatingActionButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#3b82f6',
        border: 'none',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        transition: 'all 0.2s ease-in-out',
      }}
      onMouseOver={(e) => {
        e.target.style.backgroundColor = '#2563eb';
        e.target.style.transform = 'scale(1.05)';
        e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = '#3b82f6';
        e.target.style.transform = 'scale(1)';
        e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
      }}
      aria-label="Add new post"
    >
      +
    </button>
  );
}
