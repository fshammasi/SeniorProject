import React from "react";
import "./PrivacyModal.css";

function PrivacyModal({ onClose }) {
  return (
    <div className="privacy-modal-backdrop">
      <div className="privacy-modal">
        <h2>Privacy Notice</h2>
        <p>
          This website utilizes patients' personal data to provide insights and analyze the risk of breast cancer recurrence. Our analysis incorporates regional data to ensure accuracy and relevance.
        </p>
        <p>
          The data will remain <strong>anonymous</strong> at all times, ensuring privacy and confidentiality. We are committed to safeguarding the information and adhere to strict data protection standards.
        </p>
        <p>
          By continuing to use this website, you consent to the use of your data as described in our <strong>Privacy Policy</strong>.
        </p>
        <button onClick={onClose}>I Agree</button>
      </div>
    </div>
  );
}

export default PrivacyModal;
