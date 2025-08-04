from models.database import SessionLocal, User
from security import hash_password

def add_user(username, password):
    db = SessionLocal()
    hashed_pw = hash_password(password)
    new_user = User(username=username, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.close()
    print(f"User '{username}' added!")

if __name__ == "__main__":
    add_user("admin", "password123")
