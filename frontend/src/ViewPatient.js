import React, {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import "./ResultPage.css";
import {featureNameMapping} from "./featureNameMapping";
import {customFeatureOrder} from "./customFeatureOrder"; // ✅ Import your order

function ViewPatient() {
    const {id} = useParams();
    const [patient, setPatient] = useState(null);
    const [newNotes, setNewNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`http://localhost:5050/patientsid/${id}`)
            .then((res) => res.json())
            .then((data) => {
                setPatient(data);
                setNewNotes(data.notes || "");
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    const handleDownloadPDF = () => {
        if (!patient) return;

        const doc = new jsPDF();
        doc.setFont("helvetica", "normal");

        doc.setFontSize(18);
        doc.text("Breast Cancer Recurrence Prediction", 105, 20, null, null, "center");

        doc.setFontSize(12);
        doc.text(`Patient Reference Number: ${patient.patient_reference}`, 20, 30);
        doc.text("Prediction:", 20, 40);

        if (patient.prediction === "High Risk") {
            doc.setTextColor(255, 0, 0);
        } else {
            doc.setTextColor(0, 128, 0);
        }
        doc.text(patient.prediction, 41.5, 40);
        doc.setTextColor(0, 0, 0);
        doc.text(`Probability: ${(patient.probability * 100).toFixed(1)}%`, 20, 50);

        const features = JSON.parse(patient.features_json || "{}");
        const impacts = JSON.parse(patient.impacts_json || "[]");

        const featureImpactMap = {};
        impacts.forEach((impactObj) => {
            const cleanFeature = impactObj.feature.replace("_enc", "");
            featureImpactMap[cleanFeature] = {
                impact: impactObj.impact,
                direction: impactObj.direction
            };
        });

        const tableData = customFeatureOrder
            .filter(key => key in features)
            .map((key) => {
                const impactData = featureImpactMap[key] || {impact: "N/A", direction: ""};
                const mappedFeature = featureNameMapping[key] || key;
                const cleanedImpact = impactData.impact.replace(/[↑↓]/g, '').trim();
                const signedImpact = impactData.direction === "+" ? `+ ${cleanedImpact}` :
                    impactData.direction === "-" ? `- ${cleanedImpact}` :
                        cleanedImpact;

                return {
                    feature: mappedFeature,
                    value: features[key],
                    impact: signedImpact,
                    direction: impactData.direction
                };

            });

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
                    if (direction === "+") {
                        data.cell.styles.textColor = [255, 0, 0];
                    } else if (direction === "-") {
                        data.cell.styles.textColor = [0, 128, 0];
                    }
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.text("Notes:", 20, finalY);

        const splitNotes = doc.splitTextToSize(newNotes || "N/A", 170);
        doc.setFontSize(10);
        doc.text(splitNotes, 20, finalY + 10);

        doc.save(`${patient.patient_reference}_details.pdf`);
    };

    const handleSaveNotes = async () => {
        setSaving(true);
        try {
            const response = await fetch(`http://localhost:5050/update_notes/${id}`, {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({notes: newNotes}),
            });

            const data = await response.json();
            if (response.ok) {
                alert(" Notes updated successfully!");
            } else {
                alert("❌ Failed to update notes: " + data.error);
            }
        } catch (error) {
            console.error(error);
            alert("❌ Something went wrong.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading patient details...</p>;
    if (!patient) return <p>Patient not found.</p>;

    const features = JSON.parse(patient.features_json || "{}");
    const impacts = JSON.parse(patient.impacts_json || "[]");

    const featureImpactMap = {};
    impacts.forEach((impactObj) => {
        const cleanFeature = impactObj.feature.replace("_enc", "");
        featureImpactMap[cleanFeature] = {
            impact: impactObj.impact,
            direction: impactObj.direction
        };
    });

    return (
        <div className="result-container">
            <h1 className="result-title">Patient Details</h1>

            <div className="patient-reference">
                <strong>Reference Number:</strong> {patient.patient_reference}
            </div>

            <div className="risk-score">
                <p>
                    <strong>Risk:</strong>{" "}
                    <span style={{color: patient.prediction === "High Risk" ? "red" : "green"}}>
                        {patient.prediction}
                    </span>
                </p>
                <p><strong>Probability:</strong> {(patient.probability * 100).toFixed(1)}%</p>
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
                {customFeatureOrder
                    .filter(key => key in features)
                    .map((key) => {
                        const value = features[key];
                        const impactData = featureImpactMap[key] || {impact: "N/A", direction: ""};
                        const mappedFeature = featureNameMapping[key] || key;

                        let impactColor = "black";
                        if (impactData.direction === "+") {
                            impactColor = "red";
                        } else if (impactData.direction === "-") {
                            impactColor = "green";
                        }

                        return (
                            <tr key={key}>
                                <td><strong>{mappedFeature}</strong></td>
                                <td>{value}</td>
                                <td style={{color: impactColor}}>
                                    {impactData.direction === "+" ? "+ " : impactData.direction === "-" ? "- " : ""}
                                    {impactData.impact.replace(/[↑↓]/g, '').trim()}

                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="additional-notes">
                <label><strong>Notes:</strong></label>
                <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Enter additional notes..."
                    rows="4"
                />
            </div>

            <div className="result-buttons">
                <button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? "Saving..." : "Save Notes"}
                </button>
                <button onClick={handleDownloadPDF}>Export as PDF</button>
            </div>
        </div>
    );
}

export default ViewPatient;
