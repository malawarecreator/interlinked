from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
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
    def get_post(id: str) -> Optional[Post]:
        rows = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchall()
        if not rows:
            return None
        row = rows[0]
        return Post(created_at=row[0], title=row[1], body=row[2], id=row[3], likes=row[4])
    @staticmethod
    def like_post(id: str) -> int:
        post = DataService.get_post(id)
        if not post is None:
            new_likes = post.likes + 1
            conn.execute("UPDATE posts SET likes=? WHERE id=?", (new_likes, id,))
            conn.commit()
            return 0
        return -1

class OpenAIService:
    @staticmethod
    def get_ai_summary(id: str) -> Optional[str]:
        post = DataService.get_post(id=id)
        if post is None:
            return None
        try:
            res = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant who helps summarize posts"},
                    {"role": "user", "content": f"title: {post.title} body: {post.body} | WRITE A SMALL 2 SENTENCE SUMMARY"}
                ]
            )
            return res.choices[0].message.content
        except Exception as e:
            print(f"OpenAIService: Failed to get AI summary; {e}")
            return None
    
app = FastAPI()

# Allow CORS from the frontend during development. Adjust origins for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/api")
async def apiRoot():
    return {"status": "ok"}

@app.post("/api/createPost")
async def create_post(post: Post):
    status = DataService.create_post(post)
    if status < 0:
        raise HTTPException(status_code=400, detail="Failed to create post")
    return {"status": status}

@app.post("/api/createComment")
async def create_comment(comment: Comment):
    status = DataService.create_comment(comment)
    if status < 0:
        raise HTTPException(status_code=400, detail="Failed to create comment")
    return {"status": status}

@app.get("/api/getAllPosts", response_model=List[Post])
async def get_all_posts():
    return DataService.get_all_posts()

@app.get("/api/getPost", response_model=Post)
async def get_post(id: str):
    post = DataService.get_post(id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@app.get("/api/getCommentsForPost", response_model=List[Comment])
async def get_comments_for_post(linked_post: str):
    return DataService.get_comments_for_post(linked_post)

@app.post("/api/getAISummary")
async def get_ai_summary(id: str):
    summary = OpenAIService.get_ai_summary(id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Failed to generate summary")
    return {"summary": summary}
@app.post("/api/like")
async def like_post(id: str):
    status = DataService.like_post(id)
    if status < 0:
        raise HTTPException(status_code=400, detail="Failed to like post")
    return {"status": status}
