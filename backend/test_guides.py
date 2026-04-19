import requests

BASE_URL = "http://localhost:8000"

# 1. Login to get token
# Try to login with a test user or just assume a common user like user1/password
data = {"username":"testuser", "password":"password123"}
r = requests.post(f"{BASE_URL}/login", json=data)
if r.status_code != 200:
    print("Login failed, trying to register...")
    reg_data = {"username":"testuser", "email":"test@example.com", "password":"password123"}
    r = requests.post(f"{BASE_URL}/register", json=reg_data)
    r = requests.post(f"{BASE_URL}/login", json=data)

token = r.json().get("access_token")
print(f"Token: {token[:10]}...")

headers = {"Authorization": f"Bearer {token}"}

# 2. Check current guide booking
print("Getting active booking...")
r2 = requests.get(f"{BASE_URL}/guides/booking", headers=headers)
print("Status:", r2.status_code, r2.json())

# 3. Recommend guides
print("Getting guide recommendations...")
r3 = requests.get(f"{BASE_URL}/guides/recommend?language=English", headers=headers)
print("Status:", r3.status_code, r3.json())

g_id = r3.json().get("guides", [])[0]["guide_id"] if r3.json().get("guides") else None

if g_id:
    print(f"Booking guide {g_id}...")
    book_data = {
        "guide_id": g_id,
        "name": "Test Guide",
        "language": "English",
        "estimated_budget": 5000.0
    }
    r4 = requests.post(f"{BASE_URL}/guides/book", headers=headers, json=book_data)
    print("Booking Status:", r4.status_code, r4.json())

