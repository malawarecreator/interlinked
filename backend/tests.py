import pytest
import os
import sqlite3
from datetime import datetime
from main import Post, Comment, DataService, OpenAIService

@pytest.fixture
def test_db():
    # Use in-memory SQLite for tests
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    
    # Create tables
    conn.execute("CREATE TABLE IF NOT EXISTS posts (created_at TEXT, title TEXT, body TEXT, id TEXT PRIMARY KEY, likes INTEGER)")
    conn.execute("CREATE TABLE IF NOT EXISTS comments (created_at TEXT, body TEXT, linked_post TEXT)")
    conn.commit()
    
    return conn

@pytest.fixture
def sample_post():
    return Post(
        created_at=datetime.now().isoformat(),
        title="Test Post",
        body="This is a test post body",
        id="test-post-1",
        likes=0
    )

@pytest.fixture
def sample_comment(sample_post):
    return Comment(
        created_at=datetime.now().isoformat(),
        body="This is a test comment",
        linked_post=sample_post.id
    )

def test_post_model():
    """Test Post model creation and validation"""
    post = Post(
        created_at=datetime.now().isoformat(),
        title="Test",
        body="Body",
        id="1",
        likes=0
    )
    assert post.title == "Test"
    assert post.body == "Body"
    assert post.id == "1"
    assert post.likes == 0

def test_comment_model():
    """Test Comment model creation and validation"""
    comment = Comment(
        created_at=datetime.now().isoformat(),
        body="Test Comment",
        linked_post="post-1"
    )
    assert comment.body == "Test Comment"
    assert comment.linked_post == "post-1"

def test_create_post(test_db, sample_post, monkeypatch):
    """Test post creation in DataService"""
    # Monkeypatch the global connection
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post
    status = DataService.create_post(sample_post)
    assert status == 0
    
    # Verify post exists
    cursor = test_db.execute("SELECT * FROM posts WHERE id=?", (sample_post.id,))
    post = cursor.fetchone()
    assert post is not None
    assert post[1] == sample_post.title  # title
    assert post[2] == sample_post.body   # body

def test_create_comment(test_db, sample_post, sample_comment, monkeypatch):
    """Test comment creation in DataService"""
    # Monkeypatch the global connection
    monkeypatch.setattr('main.conn', test_db)
    
    # First create a post
    DataService.create_post(sample_post)
    
    # Then create comment
    status = DataService.create_comment(sample_comment)
    assert status == 0
    
    # Verify comment exists
    cursor = test_db.execute("SELECT * FROM comments WHERE linked_post=?", (sample_post.id,))
    comment = cursor.fetchone()
    assert comment is not None
    assert comment[1] == sample_comment.body
    assert comment[2] == sample_comment.linked_post

def test_get_post(test_db, sample_post, monkeypatch):
    """Test retrieving a post"""
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post first
    DataService.create_post(sample_post)
    
    # Get post
    post = DataService.get_post(sample_post.id)
    assert post is not None
    assert post.id == sample_post.id
    assert post.title == sample_post.title
    assert post.body == sample_post.body

def test_get_all_posts(test_db, sample_post, monkeypatch):
    """Test retrieving all posts"""
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post
    DataService.create_post(sample_post)
    
    # Get all posts
    posts = DataService.get_all_posts()
    assert len(posts) > 0
    assert posts[0].id == sample_post.id

def test_get_comments_for_post(test_db, sample_post, sample_comment, monkeypatch):
    """Test retrieving comments for a post"""
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post and comment
    DataService.create_post(sample_post)
    DataService.create_comment(sample_comment)
    
    # Get comments
    comments = DataService.get_comments_for_post(sample_post.id)
    assert len(comments) > 0
    assert comments[0].body == sample_comment.body
    assert comments[0].linked_post == sample_post.id

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="OpenAI API key not found")
def test_get_ai_summary(test_db, sample_post, monkeypatch):
    """Test AI summary generation (requires OpenAI API key)"""
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post
    DataService.create_post(sample_post)
    
    # Get summary
    summary = OpenAIService.get_ai_summary(sample_post.id)
    assert summary is not None
    assert isinstance(summary, str)
    assert len(summary) > 0

def test_nonexistent_post(test_db, monkeypatch):
    """Test behavior with non-existent posts"""
    monkeypatch.setattr('main.conn', test_db)
    
    post = DataService.get_post("nonexistent-id")
    assert post is None

def test_create_comment_without_post(test_db, sample_comment, monkeypatch):
    """Test creating comment for non-existent post"""
    monkeypatch.setattr('main.conn', test_db)
    
    status = DataService.create_comment(sample_comment)
    assert status == -1  # Should fail because post doesn't exist
