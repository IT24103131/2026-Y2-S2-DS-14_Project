import requests

BASE_URL = "http://localhost:8000"

data = {"username":"testuser", "password":"password123"}
r = requests.post(f"{BASE_URL}/login", json=data)
if r.status_code != 200:
    reg_data = {"username":"testuser", "email":"test@example.com", "password":"password123"}
    requests.post(f"{BASE_URL}/register", json=reg_data)
    r = requests.post(f"{BASE_URL}/login", json=data)

token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

# Add two locations so we can optimize
loc_data = {"selected_destination": "sigiriya | dambulla"}
requests.post(f"{BASE_URL}/locations/save-selection", json=loc_data, headers=headers)

# Optimize
opt_data = {"n_days": 5, "budget_usd": 500, "starting_point": "colombo"}
print("Optimizing...")
r_opt = requests.post(f"{BASE_URL}/itineraries/optimize", json=opt_data, headers=headers)
print("Opt Status:", r_opt.status_code)
if r_opt.status_code != 200:
    print(r_opt.text)
else:
    print("Success")

