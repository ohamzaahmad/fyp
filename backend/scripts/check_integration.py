#!/usr/bin/env python3
import urllib.request, json, sys

BASE = 'http://localhost:8000'


def get(url, headers=None):
    hdrs = headers or {'Accept': 'application/json'}
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status, r.read().decode('utf-8')


def post_json(url, data, headers=None):
    data_bytes = json.dumps(data).encode('utf-8')
    hdrs = {'Content-Type': 'application/json'}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data_bytes, headers=hdrs)
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status, r.read().decode('utf-8')


if __name__ == '__main__':
    print('Checking backend integration at', BASE)

    print('\n1) GET /api/timetable/master-map/ (public)')
    try:
        status, body = get(BASE + '/api/timetable/master-map/')
        j = json.loads(body)
        print('  STATUS', status)
        print('  BUILDINGS:', list(j.keys()))
    except Exception as e:
        print('  ERROR', repr(e))

    print('\n2) POST /api/auth/token/ (login with seed_teacher)')
    try:
        status, body = post_json(BASE + '/api/auth/token/', {'username': 'seed_teacher', 'password': 'password'})
        print('  STATUS', status)
        print('  BODY', body)
        token = json.loads(body).get('access')
        if token:
            print('\n3) GET /api/auth/me/ with Bearer token')
            status, body = get(BASE + '/api/auth/me/', headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
            print('  STATUS', status)
            try:
                print('  BODY', json.loads(body))
            except Exception:
                print('  BODY', body)
        else:
            print('  No access token returned')
    except Exception as e:
        print('  ERROR', repr(e))
