##
# de-x.py -- delete all your tweets w/o API access
# Copyright 2023 Thorsten Schroeder
#
# Published under 2-Clause BSD License (https://opensource.org/license/bsd-2-clause/)
#
# Please see README.md for more information
##

import sys
import json
import os
import time
import requests

ENV_FILE = ".env"
DELETE_TWEET_QUERY_ID = "nxpZCY2K-I6QoFHAHeojFQ"
DELETE_TWEET_URL = f"https://api.x.com/graphql/{DELETE_TWEET_QUERY_ID}/DeleteTweet"
DEFAULT_RATE_LIMIT_CHECK_INTERVAL_SECONDS = 300
DEFAULT_PROGRESS_FILE = ".delete-progress.json"
ENV_HEADER_NAMES = {
    'Authorization': ('AUTHORIZATION', 'TWITTER_AUTHORIZATION'),
    'X-Csrf-Token': ('X_CSRF_TOKEN', 'TWITTER_X_CSRF_TOKEN'),
    'Cookie': ('COOKIE', 'TWITTER_COOKIE'),
}

def load_dotenv(env_file=ENV_FILE):

    if not os.path.isfile(env_file):
        return

    with open(env_file, encoding='UTF-8') as f:
        for raw_line in f:
            line = raw_line.strip()

            if not line or line.startswith('#') or '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()

            if not key:
                continue

            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]

            os.environ.setdefault(key, value)

def resolve_input_files(ac, av):

    load_dotenv()

    if ac == 3:
        return av[1], av[2]

    if ac == 1:
        tweet_file = os.getenv('TWEETS_FILE')
        request_headers_file = os.getenv('REQUEST_HEADERS_FILE')

        if tweet_file:
            return tweet_file, request_headers_file

    print(f"[!] usage: {av[0]} <jsonfile> <req-headers>")
    print("[!] or set TWEETS_FILE plus AUTHORIZATION/X_CSRF_TOKEN/COOKIE in .env")
    return None, None

def get_env_int(name, default=0):

    value = os.getenv(name)

    if not value:
        return default

    try:
        return int(value)
    except ValueError:
        print(f"[!] invalid integer for {name}: {value}")
        return default

def get_env_float(name, default=0.0):

    value = os.getenv(name)

    if not value:
        return default

    try:
        return float(value)
    except ValueError:
        print(f"[!] invalid number for {name}: {value}")
        return default

def get_env_string(name, default=""):

    value = os.getenv(name)

    if value:
        return value

    return default

def validate_input_file(path, label):

    if not path:
        print(f"[!] missing {label}")
        return False

    if not os.path.isfile(path):
        print(f"[!] file not found: {path}")
        return False

    return True

def get_tweet_ids(json_data):

    result = []
    data = json.loads(json_data)

    for d in data:
        result.append(d['tweet']['id_str'])

    return result

def parse_req_headers(request_file):

    sess = {}

    with open(request_file) as f:
        line = f.readline()
        while line:
            try:
                k,v = line.split(':', 1)
                val = v.lstrip().rstrip()
                sess[k] = val
            except:
                # ignore empty lines
                pass

            line = f.readline()

    return sess

def get_env_value(*names):

    for name in names:
        value = os.getenv(name)
        if value:
            return value

    return None

def parse_req_headers_from_env():

    sess = {}

    for header_name, env_names in ENV_HEADER_NAMES.items():
        value = get_env_value(*env_names)
        if value:
            sess[header_name] = value

    return sess

def validate_req_headers(session):

    required = {'authorization', 'x-csrf-token', 'cookie'}
    available = {k.lower() for k in session.keys()}
    missing = required - available

    if missing:
        print(f"[!] missing request headers: {', '.join(sorted(missing))}")
        print("[!] set AUTHORIZATION, X_CSRF_TOKEN, COOKIE in .env")
        return False

    return True

def wait_for_rate_limit(response):

    check_interval_seconds = max(
        get_env_int(
            'RATE_LIMIT_CHECK_INTERVAL_SECONDS',
            DEFAULT_RATE_LIMIT_CHECK_INTERVAL_SECONDS
        ),
        1
    )
    reset = response.headers.get('x-rate-limit-reset')

    if not reset:
        print(
            "[!] rate limited but no reset header was provided; "
            f"checking again in {check_interval_seconds} seconds"
        )
        time.sleep(check_interval_seconds)
        return

    try:
        seconds_until_reset = max(int(reset) - int(time.time()) + 1, 1)
    except ValueError:
        print(
            f"[!] invalid x-rate-limit-reset value: {reset}; "
            f"checking again in {check_interval_seconds} seconds"
        )
        time.sleep(check_interval_seconds)
        return

    wait_seconds = min(seconds_until_reset, check_interval_seconds)
    print(
        "[!] rate limited; "
        f"next check in {wait_seconds} seconds "
        f"(server reset hint: {seconds_until_reset} seconds)"
    )
    time.sleep(wait_seconds)

def build_session(request_headers_file):

    session = {}

    if request_headers_file:
        if not validate_input_file(request_headers_file, 'request headers file'):
            return None

        session.update(parse_req_headers(request_headers_file))

    # Environment variables override any values loaded from file.
    session.update(parse_req_headers_from_env())

    if not validate_req_headers(session):
        return None

    return session

def load_progress(progress_file, tweet_file):

    if not os.path.isfile(progress_file):
        return 0

    try:
        with open(progress_file, encoding='UTF-8') as f:
            progress = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[!] failed to read progress file {progress_file}: {exc}")
        return 0

    if not isinstance(progress, dict):
        print(f"[!] invalid progress file format: {progress_file}")
        return 0

    progress_tweet_file = progress.get('tweet_file')

    if progress_tweet_file and progress_tweet_file != tweet_file:
        print(
            f"[*] ignoring progress file {progress_file} because "
            "it belongs to a different tweet archive"
        )
        return 0

    next_index = progress.get('next_index', 0)

    if not isinstance(next_index, int) or next_index < 0:
        print(f"[!] invalid next_index in progress file: {progress_file}")
        return 0

    return next_index

def save_progress(progress_file, tweet_file, next_index, tweet_id):

    progress = {
        "tweet_file": tweet_file,
        "next_index": next_index,
        "last_completed_index": next_index - 1,
        "last_completed_tweet_id": tweet_id,
        "updated_at": int(time.time()),
    }
    tmp_progress_file = f"{progress_file}.tmp"

    with open(tmp_progress_file, 'w', encoding='UTF-8') as f:
        json.dump(progress, f, ensure_ascii=True, indent=2)
        f.write('\n')

    os.replace(tmp_progress_file, progress_file)

def main(ac, av):

    tweet_file, request_headers_file = resolve_input_files(ac, av)

    if not tweet_file:
        return

    if not validate_input_file(tweet_file, 'tweet archive file'):
        return

    f = open(tweet_file, encoding='UTF-8')
    raw = f.read()
    f.close()

    # skip data until first '['
    i = raw.find('[')

    if(i == -1):
        print(f"[!] invalid archive file: {tweet_file}")
        return

    ids = get_tweet_ids(raw[i:])

    session = build_session(request_headers_file)

    if not session:
        return

    progress_file = get_env_string('PROGRESS_FILE', DEFAULT_PROGRESS_FILE)
    checkpoint_index = load_progress(progress_file, tweet_file)
    start_index = max(get_env_int('START_INDEX', 0), 0, checkpoint_index)
    request_delay_seconds = max(get_env_float('REQUEST_DELAY_SECONDS', 0.0), 0.0)

    if start_index:
        print(f"[*] resuming at index {start_index} of {len(ids)}")

    if start_index >= len(ids):
        print("[*] all tweets in the archive have already been processed")
        return

    for idx in range(start_index, len(ids)):
        tweet_id = ids[idx]

        while True:
            response = delete_tweet(session, tweet_id)

            if response.status_code == 200:
                save_progress(progress_file, tweet_file, idx + 1, tweet_id)
                break

            if response.status_code != 429:
                print(
                    f"[!] stopping at index {idx} because delete request failed "
                    f"with status {response.status_code}"
                )
                break

            wait_for_rate_limit(response)

        if response.status_code != 200:
            return

        if request_delay_seconds > 0:
            time.sleep(request_delay_seconds)


def delete_tweet(session, tweet_id):

    print(f"[*] delete tweet-id {tweet_id}")
    data = {"variables":{"tweet_id":tweet_id,"dark_request":False},"queryId":DELETE_TWEET_QUERY_ID}

    # Match the current web client closely enough for authenticated mutations.
    session["accept"] = "*/*"
    session["content-type"] = 'application/json'
    session["referer"] = "https://x.com/"
    session["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
    session["x-twitter-active-user"] = "yes"
    session["x-twitter-auth-type"] = "OAuth2Session"
    session["x-twitter-client-language"] = "en"

    r = requests.post(DELETE_TWEET_URL, data=json.dumps(data), headers=session)
    print(r.status_code, r.reason)
    print(r.text[:500] + '...')

    return r


if __name__ == '__main__':

    main(len(sys.argv), sys.argv)
