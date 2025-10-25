import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
import os
import sqlite3
from datetime import datetime
from main import Post, Comment, DataService, OpenAIService, app

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
def client(test_db, monkeypatch):
    # Monkeypatch the global connection for API tests
    monkeypatch.setattr('main.conn', test_db)
    return TestClient(app)

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

# API Endpoint Tests
def test_create_post_api(client, sample_post):
    """Test POST /api/createPost endpoint"""
    response = client.post("/api/createPost", json=sample_post.dict())
    assert response.status_code == 200
    assert response.json() == {"status": 0}

def test_create_invalid_post_api(client):
    """Test POST /api/createPost with invalid data"""
    response = client.post("/api/createPost", json={"invalid": "data"})
    assert response.status_code == 422  # FastAPI validation error

def test_create_post_service(test_db, sample_post, monkeypatch):
    """Test post creation in DataService"""
    monkeypatch.setattr('main.conn', test_db)
    status = DataService.create_post(sample_post)
    assert status == 0
    
    cursor = test_db.execute("SELECT * FROM posts WHERE id=?", (sample_post.id,))
    post = cursor.fetchone()
    assert post is not None
    assert post[1] == sample_post.title
    assert post[2] == sample_post.body

def test_create_comment_api(client, sample_post, sample_comment):
    """Test POST /api/createComment endpoint"""
    # First create a post
    client.post("/api/createPost", json=sample_post.dict())
    
    # Then create a comment
    response = client.post("/api/createComment", json=sample_comment.dict())
    assert response.status_code == 200
    assert response.json() == {"status": 0}

def test_create_comment_without_post_api(client, sample_comment):
    """Test POST /api/createComment for non-existent post"""
    response = client.post("/api/createComment", json=sample_comment.dict())
    assert response.status_code == 400
    assert "Failed to create comment" in response.json()["detail"]

def test_create_comment_service(test_db, sample_post, sample_comment, monkeypatch):
    """Test comment creation in DataService"""
    monkeypatch.setattr('main.conn', test_db)
    DataService.create_post(sample_post)
    status = DataService.create_comment(sample_comment)
    assert status == 0
    
    cursor = test_db.execute("SELECT * FROM comments WHERE linked_post=?", (sample_post.id,))
    comment = cursor.fetchone()
    assert comment is not None
    assert comment[1] == sample_comment.body

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

def test_get_all_posts_api(client, sample_post):
    """Test GET /api/getAllPosts endpoint"""
    # Create post first
    client.post("/api/createPost", json=sample_post.dict())
    
    # Get all posts
    response = client.get("/api/getAllPosts")
    assert response.status_code == 200
    posts = response.json()
    assert len(posts) > 0
    assert posts[0]["id"] == sample_post.id

def test_get_all_posts_service(test_db, sample_post, monkeypatch):
    """Test retrieving all posts from DataService"""
    monkeypatch.setattr('main.conn', test_db)
    DataService.create_post(sample_post)
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



def test_get_ai_summary_nonexistent_post_api(client):
    """Test POST /api/getAISummary with non-existent post"""
    response = client.post("/api/getAISummary?id=nonexistent")
    assert response.status_code == 404
    assert "Failed to generate summary" in response.json()["detail"]


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

def test_like_post_service(test_db, sample_post, monkeypatch):
    """Test liking a post"""
    monkeypatch.setattr('main.conn', test_db)
    
    # Create post first
    DataService.create_post(sample_post)
    
    # Like the post
    status = DataService.like_post(sample_post.id)
    assert status == 0
    
    # Verify likes increased
    post = DataService.get_post(sample_post.id)
    assert post is not None
    assert post.likes == 1
    
    # Like again
    status = DataService.like_post(sample_post.id)
    assert status == 0
    
    # Verify likes increased again
    post = DataService.get_post(sample_post.id)
    assert post.likes == 2

def test_like_nonexistent_post_service(test_db, monkeypatch):
    """Test liking a nonexistent post"""
    monkeypatch.setattr('main.conn', test_db)
    
    status = DataService.like_post("nonexistent-id")
    assert status == -1

def test_like_post_api(client, sample_post):
    """Test POST /api/like endpoint"""
    # Create post first
    client.post("/api/createPost", json=sample_post.dict())
    
    # Like the post
    response = client.post(f"/api/like?id={sample_post.id}")
    assert response.status_code == 200
    assert response.json() == {"status": 0}
    
    # Verify likes increased
    response = client.get(f"/api/getPost?id={sample_post.id}")
    assert response.status_code == 200
    assert response.json()["likes"] == 1

def test_like_nonexistent_post_api(client):
    """Test POST /api/like with non-existent post"""
    response = client.post("/api/like?id=nonexistent")
    assert response.status_code == 400
    assert "Failed to like post" in response.json()["detail"]
