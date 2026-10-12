# Breast Cancer Recurrence Prediction Tool 🎗️

A full-stack web application that predicts the risk of breast cancer recurrence with a trained
machine learning model, and explains each prediction feature by feature.
It is built with **React** (frontend) and **Flask** (backend).

> This is a senior project for research and education. It is not a medical device and must not be
> used to make clinical decisions.


## ✨ Features

- **New patient form**: enter a patient's clinical details (36 features, with tooltips) and get a
  **High Risk / Low Risk** prediction and its probability.
- **Explainable results**: for every prediction, [SHAP](https://shap.readthedocs.io/) shows how much
  each feature raised (+) or lowered (−) the predicted probability, in percentage points.
- **Patient records**: save predictions with notes, then search, filter, view, edit notes, or delete them.
- **Dashboard**: totals, recent high-risk patients, each recent patient's most influential feature,
  and the 20 features that matter most to the model overall.
- **PDF export**: download a report for any prediction or saved patient.


## 🚀 How to Run the Project

### Requirements (install once)
- **Node.js** (LTS version): https://nodejs.org/
- **Python 3**: any version is enough to start the launcher. On a Mac, the built-in `python3` works.

> The model was saved with scikit-learn 1.6.1 and XGBoost 2.1.4, which need Python 3.10 – 3.13.
> If your computer doesn't have one of those versions, `run.py` downloads Python 3.12 automatically
> (only for your user account, using [uv](https://docs.astral.sh/uv/)), with no admin rights needed.

### Get the project
```bash
git clone https://github.com/fshammasi/SeniorProject.git
cd SeniorProject
```
Or download the ZIP from the green **Code** button on GitHub and unzip it.

### Start the application
From the project folder, run:

```bash
python3 run.py      # macOS / Linux
python run.py       # Windows
```

The **first run** sets everything up automatically (this takes a few minutes):
- downloads Python 3.12 if needed
- creates a Python environment in `.venv` and installs the packages from `requirements.txt`
- installs the frontend packages in `frontend/node_modules`
- creates the patient database from the demo data

Every run then:
- starts the Flask backend at `http://localhost:5050` and waits for the model to load
- starts the React frontend at `http://localhost:3000` and opens it in your browser

Press **Ctrl+C**, or close the terminal window, to stop both.

You can also start it from the `frontend` folder on macOS / Linux, which runs the same launcher:
```bash
cd frontend
npm start
```

### Demo data
The repository includes `demo_patients.db` with 17 test patients (not real people).
On the first start, the app copies it to `patients.db`, where new patients are saved.
`patients.db` is not tracked by git, so your own records stay on your computer.
To start over with the demo patients, delete `patients.db` and start the app again.


## 🧠 How the Prediction Works

- **Model:** an XGBoost classifier inside an imbalanced-learn pipeline, which used SMOTETomek
  to balance the classes during training. The app loads the trained pipeline from
  `final_model_pipeline.pkl`. `xgb_model.json` holds the same XGBoost model (identical
  predictions) in a format that any XGBoost version can load, as a backup in case the `.pkl`
  can't be loaded with future library versions.
- **Input:** 36 features. Category answers are converted to numbers using the encodings in
  `frontend/src/mappings.js` (features ending in `_enc`).
- **Decision threshold:** a patient is **High Risk** when the predicted probability is at least
  **80.47%** (`best_threshold.txt`). Below that, the patient is Low Risk.
- **Explanations:** SHAP's `TreeExplainer` in probability mode, with 100 training rows as the
  background. A patient's impacts add up to their predicted probability minus the average
  probability. The dashboard's overall ranking is the mean absolute impact over a fixed sample of
  500 training rows (`X_train_shap.csv`).


## 📁 Project Structure

```
SeniorProject/
├── run.py                    # One-command launcher (setup + start backend and frontend)
├── app.py                    # Flask backend: prediction, SHAP explanations, patient records API
├── requirements.txt          # Python packages (versions pinned to match the saved model)
├── final_model_pipeline.pkl  # Trained model pipeline (SMOTETomek + XGBoost)
├── best_threshold.txt        # Probability threshold for "High Risk"
├── X_train_shap.csv          # Training features, used for SHAP and the form's feature list
├── demo_patients.db          # 17 test patients, copied to patients.db on first start
├── xgb_model.json            # Backup: the same XGBoost model in XGBoost's portable JSON format
├── sample.json               # Example /predict input (demo patient REF-20250429-014)
└── frontend/                 # React app
    ├── package.json
    └── src/
        ├── App.js                  # Routes, sidebar, footer, privacy notice
        ├── NewPatientEntryForm.js  # Patient form, sends data to /predict
        ├── ResultPage.js           # Prediction report: save, notes, PDF export
        ├── PatientsRecords.js      # Saved patients: search, filter, delete
        ├── ViewPatient.js          # One saved patient: edit notes, PDF export
        ├── Dashboard.js            # Overview charts and statistics
        ├── mappings.js             # Form answers → encoded model values
        ├── featureNameMapping.js   # Readable feature names
        ├── customFeatureOrder.js   # Order of fields in the form and reports
        └── tooltips.js             # Help text for each field
```


## 🔌 Backend API

All endpoints are served at `http://localhost:5050`. Only the React frontend
(`http://localhost:3000`) is allowed to call them from a browser.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/features` | List of the model's input features |
| POST | `/predict` | Predict for one patient; returns prediction, probability and SHAP impacts |
| GET | `/shap/global` | Overall importance of each feature |
| POST | `/save_patient` | Save a prediction with notes; returns its reference number |
| GET | `/patients` | All saved patients (summary) |
| GET | `/patientsid/<id>` | One saved patient with features, impacts and notes |
| PUT | `/update_notes/<id>` | Update a patient's notes |
| DELETE | `/delete_patient/<id>` | Delete a patient |
| GET | `/dashboard/patients` | Saved patients with impacts, for the dashboard |

To try `/predict` without the website, send the example patient while the app is running:
```bash
curl -X POST http://localhost:5050/predict -H "Content-Type: application/json" -d @sample.json
```

Times are returned in UTC (ISO 8601, ending in `Z`). Reference numbers look like
`REF-YYYYMMDD-NNN`, numbered per day in local time.


## 🛠 Troubleshooting

- **"Port 5050 is already in use"**: the app is already running in another terminal window.
  Stop it there first.
- **"Node.js is not installed"**: install the LTS version from https://nodejs.org/, then open a
  new terminal window and run `run.py` again.
- **Packages look broken**: delete the `.venv` folder and/or `frontend/node_modules`, then run
  `run.py` again to reinstall.
- **Port 3000 is busy**: close whatever is using port 3000 (often another React app) and start
  again. The backend only accepts requests from the frontend on port 3000.


## 👩‍💻 Authors

Fatemah Kamil Alshammasi, Shuhd Khaled Bin Ajaj, Raghad Ayadh Alharthi, Rouda Ibrahim Mansour,
Haneen Ahmed Al-Ghzaly. © 2025, all rights reserved.
