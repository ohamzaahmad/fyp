import os
import json
import time
import redis
from django.conf import settings
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_GET
from .models import AnalyticsFeed
from django.http import HttpResponse
from django.contrib.auth import get_user_model

try:
    from rest_framework_simplejwt.state import token_backend
except Exception:
    token_backend = None

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CHANNEL = getattr(settings, 'ANALYTICS_FEED_CHANNEL', 'analytics_feed')


def get_redis_client():
    return redis.Redis.from_url(REDIS_URL)


def emit_analytics_event(event_type: str, message: str = '', payload: dict | None = None, user_id: int | None = None):
    """Persist the event and publish it to the Redis channel for SSE subscribers.

    This function is safe to call from views/tasks. If Redis is unavailable it will
    still persist to the DB (if possible) and silently continue.
    """
    try:
        payload = payload or {}
        feed = AnalyticsFeed.objects.create(
            event_type=event_type,
            message=message or '',
            payload=payload,
            user_id=user_id,
        )
        data = {
            'id': feed.pk,
            'created_at': feed.created_at.isoformat(),
            'event_type': event_type,
            'message': message or '',
            'payload': payload,
            'user_id': user_id,
        }
        try:
            rc = get_redis_client()
            rc.publish(CHANNEL, json.dumps(data))
        except Exception:
            # Redis not available — ignore publish error but keep persisted event
            pass
        return feed
    except Exception:
        # Best-effort fallback: attempt to publish minimal payload even if DB write fails
        try:
            rc = get_redis_client()
            rc.publish(CHANNEL, json.dumps({'event_type': event_type, 'message': message or '', 'payload': payload or {}}))
        except Exception:
            pass


@require_GET
def analytics_sse_view(request):
    """SSE endpoint streaming recent feed items and live events via Redis pub/sub.

    Note: this endpoint requires a streaming-capable server (ASGI or streaming WSGI)
    for production use. Nginx may buffer responses by default; set `X-Accel-Buffering: no`.
    """
    # Authentication: accept Authorization: Bearer <token> or ?token=<token>
    token = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    if not token:
        token = request.GET.get('token')

    user = None
    if token and token_backend is not None:
        try:
            payload = token_backend.decode(token)
            uid = payload.get('user_id') or payload.get('user') or payload.get('user_id')
            if uid is not None:
                User = get_user_model()
                try:
                    user = User.objects.filter(pk=uid).first()
                except Exception:
                    user = None
        except Exception:
            return HttpResponse('Unauthorized', status=401)
    else:
        # If no token provided, deny access
        return HttpResponse('Unauthorized', status=401)

    rc = get_redis_client()
    pubsub = rc.pubsub()
    try:
        pubsub.subscribe(CHANNEL)
    except Exception:
        # If Redis isn't available, fall back to streaming DB-only recent items
        pubsub = None

    feed_limit = int(getattr(settings, 'ANALYTICS_FEED_LIMIT', 50))

    def event_stream():
        # Send recent history first
        try:
            recent = AnalyticsFeed.objects.order_by('-created_at')[:feed_limit]
            for f in reversed(list(recent)):
                data = {
                    'id': f.pk,
                    'created_at': f.created_at.isoformat(),
                    'event_type': f.event_type,
                    'message': f.message,
                    'payload': f.payload or {},
                    'user_id': getattr(f.user, 'pk', None) if getattr(f, 'user', None) else None,
                }
                yield f"data: {json.dumps(data)}\n\n"
        except Exception:
            # ignore DB errors — still attempt to stream live events
            pass

        # If we have a Redis pubsub, stream live messages
        if pubsub is not None:
            try:
                # use get_message with timeout so we can periodically yield heartbeats
                while True:
                    msg = pubsub.get_message(timeout=10)
                    if msg and msg.get('type') == 'message':
                        payload = msg.get('data')
                        if isinstance(payload, bytes):
                            try:
                                payload = payload.decode('utf-8')
                            except Exception:
                                payload = str(payload)
                        # payload is expected to be a JSON string already
                        yield f"data: {payload}\n\n"
                    else:
                        # heartbeat comment (colon) to keep connection alive through proxies
                        yield ': ping\n\n'
                        time.sleep(1)
            except GeneratorExit:
                # client disconnected
                try:
                    pubsub.close()
                except Exception:
                    pass
            except Exception:
                try:
                    pubsub.close()
                except Exception:
                    pass
        else:
            # No Redis — just keep the connection open and emit periodic heartbeats
            try:
                while True:
                    yield ': ping\n\n'
                    time.sleep(5)
            except GeneratorExit:
                return

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
