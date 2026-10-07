"""
P31 → Iris bridge (Pro Edit).

Runs on the LumenCommand machine next to Iris (DavinciAIEditor, port 8756).
Every 30 s it claims the oldest queued Pro Edit job from Supabase, downloads
the footage, joins the clips, and has Iris build an Auto Edit package in the
requested look (cut, captions, grade, music mix). The package then shows up
in Iris → push it into DaVinci Resolve, finish and render, and upload the
final video from Systems → Pro Edit ("Upload finished edit").

Setup (once):
  1. Create tools/.env.iris (it is git-ignored) with:
       SUPABASE_URL=https://<project>.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=<service role key — never put this in the site>
       IRIS_URL=http://127.0.0.1:8756
       IRIS_WORKSPACE=C:\\Users\\aarons\\Desktop\\LUMENCOMMAND\\DavinciAIEditor\\workspace
  2. Start Iris (START-IRIS.bat), then:  python tools/iris_bridge.py
     (add --once to process a single job and exit)

Needs Python 3.10+ and ffmpeg on PATH (Iris needs both anyway).
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
POLL_SECONDS = 30

# P31 look names (src/features/pro-edit/irisStyles.js) → Iris style ids.
STYLE_IDS = {
    "Social Clean": "social_clean",
    "Cinematic Teal": "cinematic_teal",
    "Warm Documentary": "warm_documentary",
    "Noir": "noir_moody",
    "Bleach Grit": "bleach_grit",
    "Music Video": "music_video",
    "Dialogue Drama": "dialogue_drama",
    "Neutral Correct": "neutral_correct",
}


def load_env() -> dict[str, str]:
    env_file = HERE / ".env.iris"
    if not env_file.exists():
        sys.exit(f"Missing {env_file} — see the setup notes at the top of this file.")
    env = {}
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "IRIS_WORKSPACE"):
        if not env.get(key):
            sys.exit(f"{key} is missing from {env_file}")
    env.setdefault("IRIS_URL", "http://127.0.0.1:8756")
    return env


ENV = load_env()
SB = ENV["SUPABASE_URL"].rstrip("/")
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
IRIS = ENV["IRIS_URL"].rstrip("/") + "/api"


def http(method: str, url: str, body=None, headers=None, raw=False, timeout=120):
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        payload = res.read()
    return payload if raw else (json.loads(payload) if payload else None)


def sb(method: str, path: str, body=None, extra=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "return=representation", **(extra or {})}
    return http(method, f"{SB}/rest/v1/{path}", body, headers)


def claim_job() -> dict | None:
    jobs = sb("GET", "pro_edit_jobs?status=eq.queued&order=created_at.asc&limit=1")
    if not jobs:
        return None
    job = jobs[0]
    # Only flip it if nobody else has (status still queued).
    claimed = sb("PATCH", f"pro_edit_jobs?id=eq.{job['id']}&status=eq.queued", {"status": "processing", "error": None})
    return claimed[0] if claimed else None


def update_job(job_id: int, patch: dict):
    sb("PATCH", f"pro_edit_jobs?id=eq.{job_id}", patch)


def download(path: str, dest: Path):
    url = f"{SB}/storage/v1/object/studio/{urllib.parse.quote(path)}"
    dest.write_bytes(http("GET", url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"}, raw=True, timeout=600))


FRAMES = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080), "16:9": (1920, 1080)}


def probe(path: Path, entries: str, stream: str | None = None) -> str:
    cmd = ["ffprobe", "-v", "error"]
    if stream:
        cmd += ["-select_streams", stream]
    cmd += ["-show_entries", entries, "-of", "csv=p=0", str(path)]
    return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()


def join_clips(clips: list[Path], out: Path, aspect: str):
    """One picture file for Iris, framed for the requested format. Re-encodes so
    mixed phone formats join cleanly; clips without sound get silence."""
    if len(clips) == 1:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(clips[0]), "-c", "copy", str(out)], check=True)
        return
    w, h = FRAMES.get(aspect, FRAMES["16:9"])
    n = len(clips)
    inputs: list[str] = []
    for c in clips:
        inputs += ["-i", str(c)]
    filters = []
    extra = n
    for i, c in enumerate(clips):
        filters.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
                       f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}]")
        if probe(c, "stream=index", "a"):
            filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}]")
        else:
            dur = probe(c, "format=duration") or "1"
            inputs += ["-f", "lavfi", "-t", dur, "-i", "anullsrc=r=48000:cl=stereo"]
            filters.append(f"[{extra}:a]anull[a{i}]")
            extra += 1
    graph = ";".join(filters) + ";" + "".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph,
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                    "-c:a", "aac", "-b:a", "192k", str(out)], check=True)


def wait_iris_job(job_id: str) -> dict:
    while True:
        job = http("GET", f"{IRIS}/jobs/{job_id}")
        if job["status"] in ("done", "error", "cancelled"):
            return job
        time.sleep(5)


def process(job: dict):
    jid = job["id"]
    print(f"→ Job {jid}: {job.get('title') or 'Untitled'} ({job.get('style')}, {len(job['source_paths'])} clip(s))")
    folder = Path(ENV["IRIS_WORKSPACE"]) / "p31" / f"job-{jid}"
    folder.mkdir(parents=True, exist_ok=True)

    clips = []
    for i, path in enumerate(job["source_paths"]):
        dest = folder / f"{i + 1:02d}-{Path(path).name}"
        print(f"   downloading {path}")
        download(path, dest)
        clips.append(dest)

    picture = folder / "picture.mp4"
    print("   joining clips")
    join_clips(clips, picture, job.get('aspect') or '9:16')

    style_id = STYLE_IDS.get(job.get("style") or "", "social_clean")
    name = f"P31 · {job.get('title') or f'Job {jid}'}"
    pkg = http("POST", f"{IRIS}/packages", {
        "name": name,
        "roles": {"picture": str(picture)},
        "options": {"style_id": style_id},
    })["package"]
    print(f"   Iris package {pkg['id']} — composing ({style_id})")
    started = http("POST", f"{IRIS}/packages/{pkg['id']}/compose", {"options": {"style_id": style_id}})
    result = wait_iris_job(started["job_id"])
    if result["status"] != "done":
        raise RuntimeError(result.get("error") or f"Iris job {result['status']}")

    update_job(jid, {"iris_package": pkg["id"], "error": None})
    print(f"   ✓ ready in Iris as “{name}” — finish in Resolve, then upload from Systems → Pro Edit")


def main():
    once = "--once" in sys.argv
    try:
        http("GET", f"{IRIS}/status", timeout=10)
    except (urllib.error.URLError, OSError):
        sys.exit(f"Iris isn't reachable at {IRIS} — start START-IRIS.bat first.")
    print(f"Iris bridge running · polling every {POLL_SECONDS}s · Ctrl+C to stop")
    while True:
        job = None
        try:
            job = claim_job()
            if job:
                process(job)
        except Exception as exc:  # keep the bridge alive; record why the job failed
            print(f"   ✗ {exc}")
            if job:
                update_job(job["id"], {"status": "failed", "error": str(exc)[:500]})
        if once:
            break
        time.sleep(1 if job else POLL_SECONDS)


if __name__ == "__main__":
    main()
