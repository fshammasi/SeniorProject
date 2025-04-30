import React, {useEffect, useState} from "react";
import "./PatientsRecords.css";
import {useNavigate} from "react-router-dom";
import {FaFilter} from "react-icons/fa";

function PatientsRecords() {
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const fetchPatients = () => {
        setLoading(true);
        fetch("http://localhost:5050/patients")
            .then((res) => res.json())
            .then((data) => {
                setPatients(data);
                setFilteredPatients(data);
                setSearchQuery("");
                setFilterOpen(false);
            })
            .catch((err) => {
                console.error(err);
                setError("Failed to fetch patients. Please try again.");
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this patient?")) {
            return;
        }
        try {
            const response = await fetch(`http://localhost:5050/delete_patient/${id}`, {method: "DELETE"});
            const data = await response.json();
            if (response.ok) {
                alert("Patient deleted successfully.");
                fetchPatients();
            } else {
                alert("Failed to delete patient: " + data.error);
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Something went wrong while deleting.");
        }
    };

    const handleFilter = (filterType) => {
        if (filterType === "highRisk") {
            const highRiskPatients = patients.filter(patient => patient.prediction === "High Risk");
            setFilteredPatients(highRiskPatients);
        } else if (filterType === "lowRisk") {
            const lowRiskPatients = patients.filter(patient => patient.prediction === "Low Risk");
            setFilteredPatients(lowRiskPatients);
        } else if (filterType === "highProbability") {
            const highProbabilityPatients = patients.filter(patient => patient.probability > 0.5);
            setFilteredPatients(highProbabilityPatients);
        } else if (filterType === "lowProbability") {
            const lowProbabilityPatients = patients.filter(patient => patient.probability <= 0.5);
            setFilteredPatients(lowProbabilityPatients);
        } else if (filterType === "clear") {
            setFilteredPatients(patients);
        }
        setFilterOpen(false); // Always close after selecting a filter
    };

    if (loading) return <p>Loading patients...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="patients-container">
            <h1>Saved Patients</h1>

            {/* ADD THE CONTAINER to match NewPatient */}
            <div className="container">
                <div className="patients-buttons">
                    <div className="filter-refresh-wrapper">
                        <div className="filter-container" onMouseLeave={() => setFilterOpen(false)}>
                            <button
                                className="filter-button"
                                onClick={() => setFilterOpen(true)}
                            >
                                <FaFilter className="filter-icon"/>
                                Filter
                            </button>

                            {/* Dropdown always rendered, visibility controlled by class */}
                            <div className={`filter-dropdown ${filterOpen ? "visible" : ""}`}>
                                <button onClick={() => handleFilter("highRisk")}>High Risk Only</button>
                                <button onClick={() => handleFilter("lowRisk")}>Low Risk Only</button>
                                <button onClick={() => handleFilter("highProbability")}>Probability greater than 50%
                                </button>
                                <button onClick={() => handleFilter("lowProbability")}>Probability less than 50%
                                </button>
                                <button onClick={() => handleFilter("clear")} className="clear-filter">
                                    Clear Filter
                                </button>
                            </div>
                        </div>

                        <input
                            type="text"
                            placeholder="Search by Reference Number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-bar"
                        />

                        <button onClick={fetchPatients} className="refresh-button">
                            Refresh
                        </button>
                    </div>
                </div>

                {/*  Table inside the container */}
                {filteredPatients.length === 0 ? (
                    <p>No patients saved yet.</p>
                ) : (
                    <table className="patients-table">
                        <thead>
                        <tr>
                            <th>Reference Number</th>
                            <th>Prediction</th>
                            <th>Probability (%)</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredPatients
                            .filter(patient =>
                                patient.patient_reference.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map(patient => (
                                <tr key={patient.id}>
                                    <td>{patient.patient_reference}</td>
                                    <td>
                                      <span style={{color: patient.prediction === "High Risk" ? "red" : "green"}}>
                                        {patient.prediction}
                                      </span>
                                    </td>

                                    <td>{(patient.probability * 100).toFixed(1)}</td>
                                    <td>
                                        <button onClick={() => navigate(`/patient/${patient.id}`)}>View or Edit</button>
                                        <button onClick={() => handleDelete(patient.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {/* End of .container */}
        </div>
    );
}

export default PatientsRecords;
