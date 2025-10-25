from fastapi import FastAPI
import time
import openai
import os
import string
import random
import sqlite3

conn = sqlite3.connect("interlinked.db")

c = conn.cursor()

c.execute("CREATE TABLE IF NOT EXISTS posts (created_at TEXT, title TEXT, body TEXT, id TEXT, likes INTEGER)")
c.execute("CREATE TABLE IF NOT EXISTS comments (created_at TEXT, body TEXT, linked_post TEXT)")
conn.commit()

def gen_alphanumeric_string(length):
    characters = string.ascii_letters + string.digits
    random_string = ''.join(random.choice(characters) for _ in range(length))
    return random_string


key = ""

with open("./apikey", "r+") as file:
    content = file.read()
    key = content

openai.api_key = key



    

class Post:
    def __init__(self, created_at: str, title: str, body: str, id: str, likes: int):
        if not isinstance(created_at, str) or not isinstance(title, str) or not isinstance(body, str):
            return
        self.created_at: time.time = created_at
        self.title: str = title
        self.body: str = body
        self.id: str = id
        self.likes: int = likes
class Comment:
    def __init__(self, created_at: str, body: str, linked_post: str):
        if not isinstance(created_at, str) or not isinstance(body, str) or not isinstance(linked_post, str):
            return
        self.created_at: time.time = created_at
        self.body: str = body
        self.linked_post: str = linked_post

class DataService:
    @staticmethod
    def create_post(post: Post) -> int:
        try:
            c.execute("INSERT INTO posts VALUES (?, ?, ?, ?, ?)", (post.created_at, post.title, post.body, post.id, post.likes,))
            conn.commit()
            return 0
        except Exception as e:
            print(f"DataService: Failed to create post; {e}")
            return -1
    @staticmethod
    def create_comment(comment: Comment, linked_post: str) -> int:
        c.execute("SELECT * FROM posts WHERE id=?", (linked_post,))
        rows = c.fetchall()
        if len(rows) <= 0:
            return -1

        try:
            c.execute("INSERT INTO comments VALUES (?, ?, ?)", (comment.created_at, comment.body, linked_post))
            conn.commit()
            return 0
        except Exception as e:
            print(f"DataService: Failed to create comment; {e}")
            return -1
    @staticmethod
    def get_all_posts() -> list[Post]:
        c.execute("SELECT * FROM posts")
        rows = c.fetchall()
        posts = []
        for row in rows:
            posts.append(Post(row[0], row[1], row[2], row[3], row[4]))
        return posts
    
app = FastAPI()


@app.post("/api")
async def apiRoot():
    return {"status": "ok"}

@app.on_event("shutdown")
async def shutdown_event():
    conn.close()
