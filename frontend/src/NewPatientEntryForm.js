// NewPatientEntryForm.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mappings } from "./mappings";
import { featureNameMapping } from "./featureNameMapping";
import { customFeatureOrder } from "./customFeatureOrder";
import { tooltips } from "./tooltips";
import { Tooltip } from "react-tooltip";

function NewPatientEntryForm({ setResult }) {
  const [features, setFeatures] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5050/features")
      .then((res) => res.json())
      .then((data) => {
        const initialForm = {};
        data.forEach((feature) => (initialForm[feature] = ""));
        setFeatures(data);
        setFormData(initialForm);
      });
  }, []);

  const handleChange = (e, feature) => {
    setFormData({ ...formData, [feature]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const preparedData = {};
    const userEnteredData = {}; // 🆕 Store readable values for saving later

    for (let key in formData) {
      const value = formData[key];
      const cleanKey = key.replace("_enc", "");

      if (mappings[cleanKey]) {
        preparedData[key] = mappings[cleanKey][value]; // ML needs encoded values
        userEnteredData[cleanKey] = value; // Save readable value
      } else {
        preparedData[key] = parseFloat(value);
        userEnteredData[cleanKey] = value;
      }
    }

    fetch("http://localhost:5050/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preparedData),
    })
      .then((res) => res.json())
      .then((data) => {
        setResult({ ...data, features_original: userEnteredData }); // 🧠 Store prediction + original readable
        navigate("/result");
      })
      .catch((err) => {
        console.error(err);
        setError("Something went wrong. Please try again.");
        setLoading(false);
      });
  };

  return (
    <div className="App">
      <h1>New Patient Entry Form</h1>

      <form onSubmit={handleSubmit} className="form">
        {features
          .sort((a, b) => {
            const cleanA = a.replace("_enc", "");
            const cleanB = b.replace("_enc", "");
            const indexA = customFeatureOrder.indexOf(cleanA);
            const indexB = customFeatureOrder.indexOf(cleanB);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            return cleanA.localeCompare(cleanB);
          })
          .map((feature) => {
            const cleanFeature = feature.replace("_enc", "");

            return (
              <div key={feature} className="form-group">
                <label className="form-label">
                  {featureNameMapping[cleanFeature] || feature}
                  <span
                    data-tooltip-id={`tooltip-${feature}`}
                    data-tooltip-content={tooltips[cleanFeature] || `Please select ${featureNameMapping[cleanFeature] || feature}`}
                    className="tooltip-icon"
                    style={{ marginLeft: "5px", cursor: "pointer" }}
                  >
                    ⓘ
                  </span>
                  <Tooltip id={`tooltip-${feature}`} place="right" />
                </label>

                {cleanFeature === "Sex" ? (
                  <div className="radio-buttons-wrapper">
                    <div className="radio-buttons">
                      <label>
                        <input
                          type="radio"
                          name={feature}
                          value="FEMALE"
                          checked={formData[feature] === "FEMALE"}
                          onChange={(e) => handleChange(e, feature)}
                          required
                        />
                        Female
                      </label>
                      <label style={{ marginLeft: "10px" }}>
                        <input
                          type="radio"
                          name={feature}
                          value="MALE"
                          checked={formData[feature] === "MALE"}
                          onChange={(e) => handleChange(e, feature)}
                          required
                        />
                        Male
                      </label>
                    </div>
                  </div>
                ) : (
                  <select
                    required
                    value={formData[feature] || ""}
                    onChange={(e) => handleChange(e, feature)}
                  >
                    <option value="">Select {featureNameMapping[cleanFeature] || feature}</option>
                    {mappings[cleanFeature] ? (
                      Object.keys(mappings[cleanFeature]).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))
                    ) : (
                      <option disabled>No mapping available</option>
                    )}
                  </select>
                )}
              </div>
            );
          })}
        <button type="submit">Predict</button>
      </form>

      {loading && <p>Loading prediction...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default NewPatientEntryForm;
