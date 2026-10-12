# Breast Cancer Recurrence Prediction Tool 🎗️

This is a full-stack web application built with **React (frontend)** and **Flask (backend)** to predict the risk of breast cancer recurrence using a trained machine learning model.


## 🚀 How to Run the Project

### Requirements (install once)
- **Python 3.10 – 3.13** (3.12 recommended) — https://www.python.org/downloads/
- **Node.js** (LTS version) — https://nodejs.org/

> The trained model was saved with scikit-learn 1.6.1 and XGBoost 2.1.4, which don't support
> older or newer Python versions. On a Mac, the built-in `python3` is usually 3.9, which is too old.

### Start the application
From the project folder, run:

```bash
python3 run.py      # macOS / Linux
python run.py       # Windows
```

The **first run** sets everything up automatically (this takes a few minutes):
- creates a Python environment in `.venv` and installs the packages from `requirements.txt`
- installs the frontend packages in `frontend/node_modules`

Every run then:
- starts the Flask backend at `http://localhost:5050` (and waits for the model to load)
- starts the React frontend at `http://localhost:3000` and opens it in your browser

Press **Ctrl+C** to stop both.

### Demo data
The repository includes `demo_patients.db` with 17 test patients (not real people).
On the first start, the app copies it to `patients.db`, which is where new patients are saved.
`patients.db` is not tracked by git. To start over with the demo patients, delete `patients.db`
and start the app again.

You can also still start it the old way, from the `frontend` folder on macOS / Linux:
```bash
cd frontend
npm start
```

### Troubleshooting
- **"Port 5050 is already in use"** — the app is already running in another terminal window. Stop it there first.
- **Packages look broken** — delete the `.venv` folder and/or `frontend/node_modules` and run `run.py` again to reinstall.
