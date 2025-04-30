import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import NewPatientEntryForm from "./NewPatientEntryForm";
import Dashboard from "./Dashboard";
import PatientsRecords from "./PatientsRecords";
import ResultPage from "./ResultPage";
import ViewPatient from "./ViewPatient";
import { useState, useEffect } from "react";
import PrivacyModal from "./PrivacyModal";
import Footer from "./Footer";

function App() {
  const [result, setResult] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    const consentGiven = localStorage.getItem("privacyConsent");
    if (!consentGiven) {
      setShowPrivacyModal(true);
    }
  }, []);

  const handlePrivacyClose = () => {
    localStorage.setItem("privacyConsent", "true");
    setShowPrivacyModal(false);
  };

  const handlePrivacyClick = () => {
    setShowPrivacyModal(true);
  };

  return (
    <Router>
      {showPrivacyModal && <PrivacyModal onClose={handlePrivacyClose} />}
      {/* 🔵 Make the whole page vertical */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Main Content (Sidebar + Pages) */}
        <div style={{ flex: 1, display: "flex" }}>
          <Sidebar />
          <div style={{ marginLeft: "220px", padding: "20px", flex: 1 }}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/" element={<NewPatientEntryForm setResult={setResult} />} />
              <Route path="/records" element={<PatientsRecords />} />
              <Route path="/result" element={<ResultPage result={result} setResult={setResult} />} />
              <Route path="/patient/:id" element={<ViewPatient />} />
            </Routes>
          </div>
        </div>

        {/* Footer Always at Bottom */}
        <Footer onPrivacyClick={handlePrivacyClick} /> {/*  Now will appear */}
      </div>
    </Router>
  );
}

export default App;
