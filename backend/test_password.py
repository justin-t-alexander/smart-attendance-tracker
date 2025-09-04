from security import verify_password

def test_password(plaintext, hashed):
    if verify_password(plaintext, hashed):
        print("Password matches hash!")
    else:
        print("Password does NOT match hash.")

if __name__ == "__main__":
    # Replace below with your actual hashed password from DB
    hashed_password = "$2b$12$ec34CZ8hd9dL4WHlNMTPQO4mictRhclXZ0c/2QBO/3gvJmebSH.M6"
    # Replace below with the password you want to test
    plaintext_password = "password123"

    test_password(plaintext_password, hashed_password)
