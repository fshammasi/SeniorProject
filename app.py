from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import shap
import numpy as np
import sqlite3


# ------------------- Setup ------------------- #
app = Flask(__name__)
CORS(app)

# 🔁 Load trained pipeline (includes fitted XGBoost model)
pipeline = joblib.load("final_model_pipeline.pkl")
model = pipeline.named_steps['xgb']  #  Use fitted model directly from pipeline

# 📥 Load best threshold
with open("best_threshold.txt", "r") as f:
    best_threshold = float(f.read())

# 🔄 Load preprocessed SHAP-ready training data
X_train = pd.read_csv("X_train_shap.csv")

# ⚡ SHAP explainer (tree-optimized)
explainer = shap.TreeExplainer(model)  #  optimized for XGBoost

# 📊 Precompute global SHAP values (once)
shap_vals_global = explainer(X_train)
mean_abs_shap_global = np.abs(shap_vals_global.values).mean(axis=0)

global_summary = sorted([
    {'feature': X_train.columns[i], 'mean_shap': float(val)}
    for i, val in enumerate(mean_abs_shap_global)
], key=lambda x: x['mean_shap'], reverse=True)


# ------------------- /predict ------------------- #
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        df_input = pd.DataFrame([data])

        # 🎯 Predict recurrence risk
        prob = pipeline.predict_proba(df_input)[0][1]
        prediction = "High Risk" if prob >= best_threshold else "Low Risk"

        # 🧠 Local SHAP explanation
        shap_values = explainer(df_input)
        local_values = shap_values.values[0]

        explanation = []
        for i, val in enumerate(local_values):
            feature = df_input.columns[i]
            direction = '↑' if val > 0 else '↓'
            sign = '+' if val > 0 else '-'
            explanation.append({
                'feature': feature,
                'value': float(df_input.iloc[0, i]),
                'direction': sign,
                'impact': f'{direction} {float(abs(val * 100)):.1f}%'
            })

        return jsonify({
            'prediction': prediction,
            'probability': round(float(prob), 3),
            'shap_summary': explanation
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /save_patient ------------------- #
@app.route('/save_patient', methods=['POST'])
def save_patient():
    try:
        data = request.json
        prediction = data.get('prediction')
        probability = data.get('probability')
        features_json = data.get('features_json')
        impacts_json = data.get('impacts_json')
        notes = data.get('notes')

        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()

        today = pd.Timestamp.now().strftime('%Y%m%d')

        # 🛠 Count how many patients already saved today (not overall)
        cursor.execute('''
            SELECT COUNT(*) FROM patients
            WHERE strftime('%Y%m%d', timestamp) = ?
        ''', (today,))
        count_today = cursor.fetchone()[0] + 1  # Start counting from 1

        #  Create a truly unique Patient Reference for today
        while True:
            patient_reference = f"REF-{today}-{str(count_today).zfill(3)}"
            # 🔎 Check if this patient_reference already exists
            cursor.execute('SELECT COUNT(*) FROM patients WHERE patient_reference = ?', (patient_reference,))
            if cursor.fetchone()[0] == 0:
                break  # It's unique, safe to use
            count_today += 1  # Otherwise, increment and try again

        cursor.execute('''
            INSERT INTO patients (patient_reference, prediction, probability, features_json, impacts_json, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (patient_reference, prediction, probability, features_json, impacts_json, notes))

        conn.commit()
        conn.close()

        return jsonify({'message': 'Patient saved successfully!', 'patient_reference': patient_reference})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /shap/global ------------------- #
@app.route('/shap/global', methods=['GET'])
def global_shap():
    try:
        return jsonify(global_summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /Features ------------------- #
@app.route('/features', methods=['GET'])
def get_feature_names():
    try:
        return jsonify(X_train.columns.tolist())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- Initialize Database ------------------- #
def init_db():
    conn = sqlite3.connect('patients.db')
    cursor = conn.cursor()
    # Force creating the table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_reference TEXT UNIQUE,
            prediction TEXT,
            probability REAL,
            features_json TEXT,
            impacts_json TEXT,   -- NEW (for SHAP impacts)
            notes TEXT,          -- NEW (for additional notes)
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized successfully!")


# ------------------- /patients ------------------- #
@app.route('/patients', methods=['GET'])
def get_patients():
    try:
        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, patient_reference, prediction, probability, timestamp
            FROM patients
            ORDER BY timestamp DESC
        ''')
        rows = cursor.fetchall()
        conn.close()

        patients = []
        for row in rows:
            patients.append({
                'id': row[0],
                'patient_reference': row[1],
                'prediction': row[2],
                'probability': row[3],
                'timestamp': row[4]
            })

        return jsonify(patients)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /delete_patient ------------------- #
@app.route('/delete_patient/<int:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    try:
        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()
        cursor.execute('DELETE FROM patients WHERE id = ?', (patient_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Patient deleted successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /update_notes ------------------- #
@app.route('/update_notes/<int:patient_id>', methods=['PUT'])
def update_notes(patient_id):
    try:
        data = request.json
        new_notes = data.get('notes')

        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE patients SET notes = ? WHERE id = ?', (new_notes, patient_id))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Notes updated successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /patientsid ------------------- #
#  CORRECT VERSION
@app.route('/patientsid/<int:patient_id>', methods=['GET'])
def get_patient_by_id(patient_id):
    try:
        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, patient_reference, prediction, probability, features_json, impacts_json, notes, timestamp
            FROM patients
            WHERE id = ?
        ''', (patient_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            patient = {
                'id': row[0],
                'patient_reference': row[1],
                'prediction': row[2],
                'probability': row[3],
                'features_json': row[4],
                'impacts_json': row[5],
                'notes': row[6],
                'timestamp': row[7]
            }
            return jsonify(patient)
        else:
            return jsonify({'error': 'Patient not found'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- /dashboard/patients ------------------- #
@app.route('/dashboard/patients', methods=['GET'])
def get_patients_dashboard():
    try:
        conn = sqlite3.connect('patients.db')
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, patient_reference, prediction, probability, impacts_json, timestamp
            FROM patients
            ORDER BY timestamp DESC
        ''')
        rows = cursor.fetchall()
        conn.close()

        patients = []
        for row in rows:
            patients.append({
                'id': row[0],
                'patient_reference': row[1],
                'prediction': row[2],
                'probability': row[3],
                'impacts_json': row[4],
                'timestamp': row[5]
            })

        return jsonify(patients)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------- Run Server ------------------- #
if __name__ == '__main__':
    init_db()  # ✨ Initialize database at startup
    app.run(debug=True, port=5050)
