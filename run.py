"""
One-command launcher for the Breast Cancer Recurrence Prediction Tool.

    macOS / Linux:  python3 run.py
    Windows:        python run.py   (or: py run.py)

On the first run this sets everything up (Python packages in .venv,
Node packages in frontend/node_modules). If this computer doesn't have
Python 3.10 - 3.13, it downloads Python 3.12 automatically (using uv).
After that it just starts:
  - the Flask backend  at http://localhost:5050
  - the React frontend at http://localhost:3000 (opens in your browser)

Press Ctrl+C to stop both.
"""

import hashlib
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(ROOT, "frontend")
VENV = os.path.join(ROOT, ".venv")
TOOLS = os.path.join(ROOT, ".tools")  # only used if uv has to be installed
REQUIREMENTS = os.path.join(ROOT, "requirements.txt")
BACKEND_PORT = 5050

IS_WINDOWS = os.name == "nt"
IS_MAC = sys.platform == "darwin"

# The saved model needs scikit-learn 1.6.1 / XGBoost 2.1.4,
# which are only available for these Python versions.
SUPPORTED_PYTHONS = [(3, 12), (3, 11), (3, 13), (3, 10)]


# ------------------- Helpers ------------------- #
def step(msg):
    print(f"\n==> {msg}", flush=True)


def fail(msg):
    print(f"\n[!] {msg}\n", file=sys.stderr, flush=True)
    sys.exit(1)


def file_hash(*paths):
    h = hashlib.sha256()
    for p in paths:
        if os.path.exists(p):
            with open(p, "rb") as f:
                h.update(f.read())
    return h.hexdigest()


def is_up_to_date(stamp_file, current_hash):
    try:
        with open(stamp_file) as f:
            return f.read().strip() == current_hash
    except OSError:
        return False


def write_stamp(stamp_file, current_hash):
    with open(stamp_file, "w") as f:
        f.write(current_hash)


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


# ------------------- Python ------------------- #
def python_version_of(cmd):
    try:
        out = subprocess.run(
            cmd + ["-c", "import sys; print(sys.version_info[0], sys.version_info[1])"],
            capture_output=True, text=True, timeout=20,
        )
        major, minor = out.stdout.split()
        return int(major), int(minor)
    except Exception:
        return None


def find_supported_python():
    """Return a command (list) for a Python that can run the model."""
    if sys.version_info[:2] in SUPPORTED_PYTHONS:
        return [sys.executable]

    candidates = []
    for major, minor in SUPPORTED_PYTHONS:
        if IS_WINDOWS:
            candidates.append(["py", f"-{major}.{minor}"])
        candidates.append([f"python{major}.{minor}"])
    candidates += [["python3"], ["python"]]

    # Also look in ~/.local/bin (where uv installs Python) even if it's not on PATH
    local_bin = os.path.join(os.path.expanduser("~"), ".local", "bin")
    for major, minor in SUPPORTED_PYTHONS:
        exe = os.path.join(local_bin, f"python{major}.{minor}")
        if os.path.exists(exe):
            candidates.append([exe])

    for cmd in candidates:
        if not shutil.which(cmd[0]) and not os.path.exists(cmd[0]):
            continue
        if python_version_of(cmd) in SUPPORTED_PYTHONS:
            return cmd
    return None


def find_or_install_uv():
    """Return the path to uv (https://docs.astral.sh/uv/), installing it into .tools if needed."""
    uv = shutil.which("uv")
    if uv:
        return uv

    # Install uv with pip into a small separate environment, using whatever Python is running this script
    tools_uv = os.path.join(TOOLS, "Scripts", "uv.exe") if IS_WINDOWS else os.path.join(TOOLS, "bin", "uv")
    if not os.path.exists(tools_uv):
        step("Installing uv (a tool that downloads the right Python version)")
        tools_python = os.path.join(TOOLS, "Scripts", "python.exe") if IS_WINDOWS else os.path.join(TOOLS, "bin", "python")
        try:
            subprocess.run([sys.executable, "-m", "venv", TOOLS], check=True)
            subprocess.run([tools_python, "-m", "pip", "install", "--quiet", "uv"], check=True)
        except (subprocess.CalledProcessError, OSError):
            shutil.rmtree(TOOLS, ignore_errors=True)
            versions = ", ".join(f"{a}.{b}" for a, b in sorted(SUPPORTED_PYTHONS))
            fail(
                f"This project needs Python {versions}, and it could not be installed automatically.\n"
                "    Install Python 3.12 from https://www.python.org/downloads/ and run this again."
            )
    return tools_uv


def venv_python():
    if IS_WINDOWS:
        return os.path.join(VENV, "Scripts", "python.exe")
    return os.path.join(VENV, "bin", "python")


def setup_python():
    # A .venv made by a different (or unsupported) Python must be rebuilt
    if os.path.exists(venv_python()) and python_version_of([venv_python()]) not in SUPPORTED_PYTHONS:
        step("Existing .venv uses an unsupported Python version - rebuilding it")
        shutil.rmtree(VENV)

    if not os.path.exists(venv_python()):
        python = find_supported_python()
        if python is not None:
            step(f"Creating Python environment (.venv) with {' '.join(python)}")
            subprocess.run(python + ["-m", "venv", VENV], check=True)
        else:
            # No suitable Python on this computer: let uv download Python 3.12
            # (just for this user, no admin rights needed) and build .venv with it.
            step(f"Python {sys.version.split()[0]} can't run the model - downloading Python 3.12 (first run only)")
            subprocess.run([find_or_install_uv(), "venv", "--seed", "--python", "3.12", VENV], check=True)

    stamp = os.path.join(VENV, ".requirements-hash")
    current = file_hash(REQUIREMENTS)
    if not is_up_to_date(stamp, current):
        step("Installing Python packages (first run only, may take a few minutes)")
        subprocess.run([venv_python(), "-m", "pip", "install", "--upgrade", "pip"], check=True)
        subprocess.run([venv_python(), "-m", "pip", "install", "-r", REQUIREMENTS], check=True)
        write_stamp(stamp, current)


def backend_env():
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    if IS_MAC:
        # XGBoost on macOS needs the OpenMP library (libomp), which is normally
        # installed with Homebrew. scikit-learn ships its own copy, so point
        # XGBoost at it - this way no extra install is needed.
        dylibs = subprocess.run(
            [venv_python(), "-c",
             "import os, sklearn; print(os.path.join(os.path.dirname(sklearn.__file__), '.dylibs'))"],
            capture_output=True, text=True,
        ).stdout.strip()
        if dylibs and os.path.isdir(dylibs):
            env["DYLD_LIBRARY_PATH"] = os.pathsep.join(
                p for p in [dylibs, env.get("DYLD_LIBRARY_PATH")] if p
            )
    return env


# ------------------- Node ------------------- #
def npm_command():
    npm = shutil.which("npm")
    if npm is None:
        fail(
            "Node.js is not installed (needed for the website part of the app).\n"
            "    Install the LTS version from https://nodejs.org/ and run this again."
        )
    return npm


def setup_node(npm):
    node_modules = os.path.join(FRONTEND, "node_modules")
    stamp = os.path.join(node_modules, ".install-hash")
    current = file_hash(os.path.join(FRONTEND, "package.json"),
                        os.path.join(FRONTEND, "package-lock.json"))
    if not os.path.isdir(node_modules) or not is_up_to_date(stamp, current):
        step("Installing frontend packages (first run only, may take a few minutes)")
        subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND, check=True)
        write_stamp(stamp, file_hash(os.path.join(FRONTEND, "package.json"),
                                     os.path.join(FRONTEND, "package-lock.json")))


# ------------------- Run ------------------- #
def start(cmd, cwd, env):
    kwargs = {"cwd": cwd, "env": env}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True  # so we can stop its child processes too
    return subprocess.Popen(cmd, **kwargs)


def stop(proc):
    if proc is None or proc.poll() is not None:
        return
    try:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
        else:
            os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=10)
    except Exception:
        pass


def wait_for_backend(proc, timeout=300):
    """The backend computes SHAP values at startup, so give it time."""
    url = f"http://127.0.0.1:{BACKEND_PORT}/features"
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            return False
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def main():
    os.chdir(ROOT)

    # Tools installed just for this user (e.g. by uv) live in ~/.local/bin,
    # which isn't always on PATH - add it so Python/Node can be found.
    local_bin = os.path.join(os.path.expanduser("~"), ".local", "bin")
    if os.path.isdir(local_bin) and local_bin not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = local_bin + os.pathsep + os.environ.get("PATH", "")

    backend_only = "--backend-only" in sys.argv

    setup_python()
    npm = None if backend_only else npm_command()
    if npm:
        setup_node(npm)

    if port_in_use(BACKEND_PORT):
        fail(f"Port {BACKEND_PORT} is already in use - is the app already running in another window?")

    # Closing the terminal window (SIGHUP) or a plain `kill` (SIGTERM) should stop
    # both servers too, just like Ctrl+C - otherwise they keep running in the background.
    def stop_on_signal(signum, frame):
        raise KeyboardInterrupt
    for name in ("SIGTERM", "SIGHUP"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), stop_on_signal)

    backend = frontend = None
    try:
        step(f"Starting backend on http://localhost:{BACKEND_PORT} (loading the model...)")
        backend = start([venv_python(), "app.py"], ROOT, backend_env())
        if not wait_for_backend(backend):
            fail("The backend did not start - see the error messages above.")
        print("    Backend is ready.", flush=True)

        if not backend_only:
            step("Starting frontend on http://localhost:3000 (your browser will open)")
            frontend = start([npm, "run", "react-start"], FRONTEND, os.environ.copy())
            print("    Press Ctrl+C to stop the app.\n", flush=True)

        while True:
            if backend.poll() is not None:
                fail("The backend stopped unexpectedly - see the error messages above.")
            if frontend is not None and frontend.poll() is not None:
                fail("The frontend stopped unexpectedly - see the error messages above.")
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping...", flush=True)
    finally:
        stop(frontend)
        stop(backend)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        fail(f"Setup step failed: {' '.join(map(str, e.cmd))}\n    See the error messages above.")
