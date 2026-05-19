import json
import urllib.request
import urllib.error
import secrets

API_BASE = 'http://127.0.0.1:8000/api'

def post(path, data, token=None):
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type':'application/json'})
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode())
        raise


def patch(path, data, token=None):
    url = f"{API_BASE}{path}"
    # urllib in some Python versions supports method param in Request
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type':'application/json'}, method='PATCH')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode())
        raise

def get(path, token=None):
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode())
        raise


def main():
    # Login as admin to create a temporary teacher
    print('Logging in as admin to create a temporary teacher...')
    admin = post('/auth/token/', {'username': 'admin', 'password': 'admin'})
    admin_access = admin.get('access')

    # Create a temporary teacher via admin API (use random email to avoid collisions)
    print('Creating temporary teacher via admin API...')
    rand = secrets.token_urlsafe(4).lower()
    temp_email = f'temp_{rand}@example.com'
    # Use an existing department id and include a course in can_teach
    new_teacher = post('/faculties/', {'name': 'Temp Teacher', 'email': temp_email, 'department': 2, 'can_teach': [2]}, token=admin_access)
    print('Created teacher:', new_teacher)
    teacher_username = new_teacher.get('username')
    teacher_temp_pw = new_teacher.get('temp_password')

    # Login as the created teacher
    print('Logging in as new teacher', teacher_username)
    t = post('/auth/token/', {'username': teacher_username, 'password': teacher_temp_pw})
    access = t.get('access')

    # Ensure teacher clears must_change_password by calling change-password (middleware blocks other endpoints until changed)
    print('Ensuring teacher changed initial password via change-password endpoint...')
    try:
        cp = post('/auth/change-password/', {'old_password': teacher_temp_pw, 'new_password': 'teacher123'}, token=access)
        print('Change-password response:', cp)
    except Exception as e:
        print('Change-password call failed or not required:', e)

    print('Fetching entries...')
    entries = get('/entries/', token=access)
    if not entries:
        print('No entries returned')
        return
    entry = entries[0]
    entry_id = entry.get('id')
    print('Using entry id:', entry_id)

    print('Creating adjustment request for entry', entry_id)
    req = post('/adjustment-requests/', {'related_entry': entry_id, 'requested_day': 'Tue', 'requested_time': '09:30', 'reason': 'Test adjustment'}, token=access)
    print('Created request:', req)

    req_id = req.get('id')
    print('Logging in as admin...')
    a = post('/auth/token/', {'username': 'admin', 'password': 'admin'})
    admin_access = a.get('access')

    print('Approving request via API PATCH...')
    approve = patch(f'/adjustment-requests/{req_id}/', {'status': 'APPROVED'}, token=admin_access)
    print('Approve response:', approve)

    print('Fetching updated entry...')
    updated = get(f'/entries/{entry_id}/', token=admin_access)
    print('Updated entry:', updated)

if __name__ == '__main__':
    main()
