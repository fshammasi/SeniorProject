import {useState} from "react";
import React from "react";
import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import {mappings} from "./mappings";
import {featureNameMapping} from "./featureNameMapping";
import {customFeatureOrder} from "./customFeatureOrder";
import "./ResultPage.css";


function ResultPage({result, setResult}) {

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);


    if (!result) {
        return <p>No prediction available. Please submit the form first.</p>;
    }

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.setFont("helvetica", "normal");

        // Title
        doc.setFontSize(18);
        doc.text("Breast Cancer Recurrence Prediction", 105, 20, null, null, "center");

        // ✨ Print Patient Reference Number
        doc.setFontSize(12);
        doc.text(`Patient Reference Number: ${result.patient_reference || "N/A"}`, 20, 30);


        // Prediction Info
        doc.setFontSize(12);
        doc.text("Prediction:", 20, 40);

        if (result.prediction === "High Risk") {
            doc.setTextColor(255, 0, 0); // Red
        } else {
            doc.setTextColor(0, 128, 0); // Green
        }
        doc.text(result.prediction, 41.5, 40);

        doc.setTextColor(0, 0, 0);

        // Probability
        doc.text(`Probability: ${(result.probability * 100).toFixed(1)}%`, 20, 50);

        // Table Data Preparation
        const tableData = (result.shap_summary || [])
            .filter((item) => item.feature !== "Oncotype Dx Risk Unknown Flag")
            .sort((a, b) => {
                const aClean = a.feature.replace("_enc", "");
                const bClean = b.feature.replace("_enc", "");
                const indexA = customFeatureOrder.indexOf(aClean);
                const indexB = customFeatureOrder.indexOf(bClean);
                return (indexA !== -1 && indexB !== -1) ? indexA - indexB : aClean.localeCompare(bClean);
            })
            .map((item) => {
                const cleanFeature = item.feature.replace("_enc", "");
                const displayLabel = featureNameMapping[cleanFeature] || cleanFeature;
                let displayValue = item.value;

                if (mappings[cleanFeature]) {
                    const reverseMapping = Object.entries(mappings[cleanFeature]).find(
                        ([key, encodedVal]) => encodedVal === item.value
                    );
                    if (reverseMapping) {
                        displayValue = reverseMapping[0];
                    }
                }

                const rawImpact = parseFloat(item.impact.replace(/[^0-9.-]/g, ""));
                const formattedImpact = isNaN(rawImpact)
                    ? "0.0%"
                    : `${item.direction === "+" ? "+ " : "- "}${Math.abs(rawImpact).toFixed(1)}%`;


                return {
                    feature: displayLabel,
                    value: displayValue,
                    impact: formattedImpact,
                    direction: item.direction
                };
            });

        // Table Generation
        autoTable(doc, {
            head: [["Feature", "Value", "Impact"]],
            body: tableData.map(row => [row.feature, row.value, row.impact]),
            startY: 65,
            theme: 'grid',
            headStyles: {fillColor: [252, 175, 199]},
            styles: {
                fontSize: 10,
                cellPadding: 3,
            },
            columnStyles: {
                0: {cellWidth: 70},
                1: {cellWidth: 50},
                2: {cellWidth: 40},
            },
            margin: {horizontal: (doc.internal.pageSize.getWidth() - 160) / 2},
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    const rowIndex = data.row.index;
                    const direction = tableData[rowIndex].direction;
                    data.cell.styles.textColor = direction === "+" ? [255, 0, 0] : [0, 128, 0];
                }
            }
        });

        // Add Additional Notes
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text("Additional Notes:", 20, finalY);

        const notesTextarea = document.querySelector(".additional-notes textarea");
        if (notesTextarea) {
            const notesText = notesTextarea.value || "N/A";
            const splitNotes = doc.splitTextToSize(notesText, 170);
            doc.setFontSize(10);
            doc.text(splitNotes, 20, finalY + 10);
        }

        doc.save("prediction_result.pdf");
    };

    const handleSavePatient = async () => {
        if (isSaving || saved) return; // ⛔ Block fast double click

        setSaved(true); //  Immediately lock the Save button
        setIsSaving(true); // ⏳ Show Saving...

        try {
            const notesTextarea = document.querySelector(".additional-notes textarea");
            const notes = notesTextarea ? notesTextarea.value : "";

            const response = await fetch("http://localhost:5050/save_patient", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    prediction: result.prediction,
                    probability: result.probability,
                    features_json: JSON.stringify(result.features_original || {}),
                    impacts_json: JSON.stringify(result.shap_summary || {}),
                    notes: notes
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert("Patient saved successfully!");
                setResult({...result, patient_reference: data.patient_reference});
            } else {
                alert("❌ Failed to save patient: " + data.error);
            }
        } catch (error) {
            console.error("Save Error:", error);
            alert("❌ Something went wrong while saving.");
        } finally {
            setIsSaving(false); //  Always stop loading spinner
        }
    };


    const shapSummarySorted = [...(result.shap_summary || [])]
        .filter((item) => item.feature !== "Oncotype Dx Risk Unknown Flag")
        .sort((a, b) => {
            const aClean = a.feature.replace("_enc", "");
            const bClean = b.feature.replace("_enc", "");
            const indexA = customFeatureOrder.indexOf(aClean);
            const indexB = customFeatureOrder.indexOf(bClean);
            return (indexA !== -1 && indexB !== -1) ? indexA - indexB : aClean.localeCompare(bClean);
        });

    return (
        <div className="result-container">
            <h1 className="result-title">Risk Recurrence Score</h1>

            <div className="patient-reference">
                <strong>Patient Reference
                    Number:</strong> {result.patient_reference ? result.patient_reference : "Generating..."}
            </div>

            <table className="result-table">
                <thead>
                <tr>
                    <th>Feature</th>
                    <th>Value</th>
                    <th>Impact</th>
                </tr>
                </thead>
                <tbody>
                {shapSummarySorted.map((item, index) => {
                    const cleanFeature = item.feature.replace("_enc", "");
                    const displayLabel = featureNameMapping[cleanFeature] || cleanFeature;
                    let displayValue = item.value;

                    if (mappings[cleanFeature]) {
                        const reverseMapping = Object.entries(mappings[cleanFeature]).find(
                            ([key, encodedVal]) => encodedVal === item.value
                        );
                        if (reverseMapping) {
                            displayValue = reverseMapping[0];
                        }
                    }

                    const rawImpact = parseFloat(item.impact.replace(/[^0-9.-]/g, ""));
                    const impactColor = item.direction === "+" ? "red" : "green";

                    return (
                        <tr key={index}>
                            <td><strong>{displayLabel}</strong></td>
                            <td>{displayValue}</td>
                            <td style={{color: impactColor}}>
                                {item.direction === "+" ? "+ " : "- "}{Math.abs(rawImpact).toFixed(1)}%
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>

            <p className="result-description">
                This result reflects the probability of recurrence based on AI analysis of clinical features.
                The prediction is based on the patient's clinical data and contributing factors analyzed by the AI
                model.
                Please refer to the detailed breakdown of contributing factors for further insights.
            </p>

            <div className="risk-score">
                <p>
                    <strong>Risk:</strong>{" "}
                    <span style={{color: result.prediction === "High Risk" ? "red" : "green"}}>
            {result.prediction}
          </span>
                </p>
                <p>
                    <strong>Probability:</strong> {(result.probability * 100).toFixed(1)}%
                </p>
            </div>

            <div className="additional-notes">
                <label><strong>Additional Notes:</strong></label>
                <textarea placeholder="...." rows="4"/>
            </div>

            <div className="result-buttons">
                <button
                    type="button"
                    onClick={handleSavePatient}
                    disabled={isSaving || saved}
                    style={{
                        backgroundColor: (isSaving || saved) ? "lightgray" : "",
                        cursor: (isSaving || saved) ? "not-allowed" : "",
                    }}
                >
                    {isSaving ? "Saving..." : saved ? "Saved" : "Save"}
                </button>


                <button onClick={handleDownloadPDF}>Export as PDF</button>
            </div>
        </div>
    );
}

export default ResultPage;
