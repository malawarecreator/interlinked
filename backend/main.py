from fastapi import FastAPI
import openai
import os
import sqlite3
from pydantic import BaseModel

conn = sqlite3.connect("interlinked.db", check_same_thread=False)

conn.execute("CREATE TABLE IF NOT EXISTS posts (created_at TEXT, title TEXT, body TEXT, id TEXT PRIMARY KEY, likes INTEGER)")
conn.execute("CREATE TABLE IF NOT EXISTS comments (created_at TEXT, body TEXT, linked_post TEXT)")
conn.commit()



key = os.environ.get("OPENAI_API_KEY")
if not key:
    try:
        apikey_path = os.path.join(os.path.dirname(__file__), "apikey")
        with open(apikey_path, "r") as f:
            key = f.read().strip()
    except FileNotFoundError:
        key = None

if key:
    openai.api_key = key



    

class Post(BaseModel):
    created_at: str
    title: str
    body: str
    id: str
    likes: int = 0


class Comment(BaseModel):
    created_at: str
    body: str
    linked_post: str

class DataService:
    @staticmethod
    def create_post(post: Post) -> int:
        try:
            conn.execute("INSERT INTO posts VALUES (?, ?, ?, ?, ?)", (post.created_at, post.title, post.body, post.id, post.likes,))
            conn.commit()
            return 0
        except Exception as e:
            print(f"DataService: Failed to create post; {e}")
            return -1

    @staticmethod
    def create_comment(comment: Comment) -> int:
        rows = conn.execute("SELECT * FROM posts WHERE id=?", (comment.linked_post,)).fetchall()
        if len(rows) <= 0:
            return -1

        try:
            conn.execute("INSERT INTO comments VALUES (?, ?, ?)", (comment.created_at, comment.body, comment.linked_post))
            conn.commit()
            return 0
        except Exception as e:
            print(f"DataService: Failed to create comment; {e}")
            return -1

    @staticmethod
    def get_all_posts() -> list[Post]:
        rows = conn.execute("SELECT * FROM posts").fetchall()
        posts = []
        for row in rows:
            posts.append(Post(created_at=row[0], title=row[1], body=row[2], id=row[3], likes=row[4]))
        return posts

    @staticmethod
    def get_comments_for_post(linked_post: str) -> list[Comment]:
        rows = conn.execute("SELECT * FROM comments WHERE linked_post=?", (linked_post,)).fetchall()
        comments = []
        for row in rows:
            comments.append(Comment(created_at=row[0], body=row[1], linked_post=row[2]))
        return comments
    @staticmethod
    def get_post(id: str) -> Post:
        rows = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchall()
        if len(rows) <= 0:
            return None
        row = rows[0]
        return Post(created_at=row[0], title=row[1], body=row[2], id=row[3], likes=row[4])


    
app = FastAPI()



@app.get("/api")
async def apiRoot():
    return {"status": "ok"}

@app.post("/api/createPost")
async def create_post(post: Post):
    status = DataService.create_post(post)
    if status < 0:
        return "error"
    else:
        return {"status": status}

@app.post("/api/createComment")
async def create_comment(comment: Comment):
    status = DataService.create_comment(comment)
    if status < 0:
        return "error"
    else:
        return {"status": status}
@app.get("/api/getAllPosts")
async def get_all_posts():
    posts = DataService.get_all_posts()
    return posts
@app.get("/api/getPost")
async def get_post(id: str):
    post = DataService.get_post(id)
    if post == None:
        return "Not found"
    else:
        return post

    
@app.get("/api/getCommentsForPost")
async def get_comments_for_post(linked_post: str):
    comments = DataService.get_comments_for_post(linked_post)
    return comments

@app.on_event("shutdown")
async def shutdown_event():
    conn.close()
