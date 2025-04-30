import React, {useEffect, useState} from 'react';
import './Dashboard.css';
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell} from 'recharts';
import {featureNameMapping} from './featureNameMapping';

function Dashboard() {
    const [patients, setPatients] = useState([]);
    const [globalShap, setGlobalShap] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5050/dashboard/patients")
            .then(res => res.json())
            .then(data => setPatients(data))
            .catch(err => console.error("Error fetching patients:", err));

        fetch("http://localhost:5050/shap/global")
            .then(res => res.json())
            .then(data => setGlobalShap(data))
            .catch(err => console.error("Error fetching global SHAP:", err));
    }, []);

    const top20GlobalShap = globalShap
        .sort((a, b) => b.mean_shap - a.mean_shap)
        .slice(0, 20)
        .map(item => {
            const rawFeature = item.feature.replace("_enc", "");
            const mappedFeature = featureNameMapping[rawFeature] || rawFeature;
            return {
                feature: mappedFeature,
                mean_shap: parseFloat(item.mean_shap.toFixed(2))
            };
        });

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <img src={process.env.PUBLIC_URL + "/logo.png"} alt="Logo" className="dashboard-logo" />
                <h1 className="dashboard-title">Breast Cancer Recurrence Overview</h1>
            </div>

            {/* Top Section */}
            <div className="dashboard-top">
                {/* Recent Patients */}
                <div className="dashboard-card">
                    <h2>Recent Patients and their Most Impact Features</h2>

                    {patients.length === 0 ? (
                        <p className="no-patients-message">No patients added yet.</p>
                    ) : (

                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                                data={patients
                                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                    .slice(0, 5)
                                    .map((patient) => {
                                        const impacts = patient.impacts_json ? JSON.parse(patient.impacts_json) : [];
                                        const topImpact = impacts.length > 0
                                            ? [...impacts]
                                                .sort((a, b) => {
                                                    const aValue = parseFloat(a.impact.replace(/[^0-9.-]/g, ""));
                                                    const bValue = parseFloat(b.impact.replace(/[^0-9.-]/g, ""));
                                                    return Math.abs(bValue) - Math.abs(aValue);
                                                })[0]
                                            : null;

                                        if (!topImpact) return null;

                                        const rawFeature = topImpact.feature.replace("_enc", "");
                                        const mappedFeature = featureNameMapping[rawFeature] || rawFeature;

                                        return {
                                            reference_feature: `${patient.patient_reference} - ${mappedFeature}`,
                                            impactValue: parseFloat(topImpact.impact.replace(/[^0-9.-]/g, "")),
                                            direction: topImpact.direction
                                        };
                                    })
                                    .filter((item) => item !== null)
                                }
                                layout="vertical"
                                margin={{top: 20, right: 20, left: 0, bottom: 20}}
                                barCategoryGap={10}
                            >
                                <XAxis type="number"/>
                                <YAxis dataKey="reference_feature" type="category" width={300}/>
                                <Tooltip
                                    content={({payload, label, active}) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div style={{
                                                    backgroundColor: "#fff",
                                                    border: "1px solid #ccc",
                                                    borderRadius: "10px",
                                                    fontSize: "12px",
                                                    padding: "5px",
                                                    width: "120px",
                                                    textAlign: "center",
                                                    color: "#000",
                                                    boxShadow: "0px 2px 8px rgba(0,0,0,0.1)"
                                                }}>
                                                    <p style={{margin: 0, fontWeight: "bold"}}>
                                                        {label.split(' - ')[1]} {/*  Just the feature name after the dash */}
                                                    </p>
                                                    <p style={{margin: 0}}>
                                                        {`${payload[0].value}% Impact`}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />


                                <Bar
                                    dataKey="impactValue"
                                    barSize={15}
                                    activeBar={{fill: "#fcafc7"}}
                                >
                                    {
                                        patients
                                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                            .slice(0, 5)
                                            .map((patient, index) => {
                                                const impacts = patient.impacts_json ? JSON.parse(patient.impacts_json) : [];
                                                const topImpact = impacts.length > 0
                                                    ? [...impacts].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0]
                                                    : null;
                                                if (!topImpact) return null;
                                                return (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill="lightgray"
                                                    />
                                                );
                                            })
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* High Risk Patients */}
                <div className="dashboard-card">
                    <h2>High Risk Patients</h2>

                    {patients.filter(p => p.prediction === "High Risk").length === 0 ? (
                        <p className="no-patients-message">No high-risk patients found.</p>
                    ) : (

                        <table className="high-risk-table">
                            <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Probability</th>
                                <th>Date</th>
                            </tr>
                            </thead>
                            <tbody>
                            {patients
                                .filter((p) => p.prediction === "High Risk")
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                .slice(0, 5)
                                .map((patient) => (
                                    <tr key={patient.id}>
                                        <td>{patient.patient_reference}</td>
                                        <td style={{color: "red", fontWeight: "bold"}}>
                                            {(patient.probability * 100).toFixed(0)}%
                                        </td>
                                        <td>{new Date(patient.timestamp).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Info Cards Section */}
            <div className="info-cards">
                <div className="info-card total">
                    <p>Total Patients: {patients.length}</p>
                </div>
                <div className="info-card high-risk">
                    <p>High Risk Patients: {patients.filter(p => p.prediction === "High Risk").length}</p>
                </div>
                <div className="info-card low-risk">
                    <p>Low Risk Patients: {patients.filter(p => p.prediction === "Low Risk").length}</p>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="dashboard-bottom">
                <div className="dashboard-card">
                    <h2>Trends in the Contributing Factors (Top 20)</h2>
                    <ResponsiveContainer width="100%" height={600}>
                        <BarChart
                            data={top20GlobalShap}
                            layout="vertical"
                            margin={{top: 20, right: 20, left: 20, bottom: 20}}
                        >
                            <XAxis type="number"/>
                            <YAxis dataKey="feature" type="category" width={200}/>
                            <Tooltip
                                content={({payload, label, active}) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div style={{
                                                backgroundColor: "#fff",
                                                border: "1px solid #ccc",
                                                borderRadius: "10px",
                                                fontSize: "12px",
                                                padding: "5px",
                                                width: "120px",
                                                textAlign: "center",
                                                color: "#000", //  now this will work!
                                                boxShadow: "0px 2px 8px rgba(0,0,0,0.1)"
                                            }}>
                                                <p style={{margin: 0, fontWeight: "bold"}}>{label}</p>
                                                <p style={{margin: 0}}>{`${payload[0].value}% Impact`}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            <Bar
                                dataKey="mean_shap"
                                fill="lightgray"
                                activeBar={{fill: "#fcafc7"}}
                            >
                                {top20GlobalShap.map((entry, index) => (
                                    <Cell key={`cell-${index}`}/>
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
