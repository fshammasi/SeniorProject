import React from "react";
import "./Footer.css";

function Footer({ onPrivacyClick }) {
  return (
    <footer className="footer">
      <div className="footer-line"></div>
      <div className="footer-content">
        <img src={process.env.PUBLIC_URL + "/logo.png"}  alt="Logo" className="footer-logo" />
        <div className="footer-text">
          <p>Copyright © 2025, Fatemah Kamil Alshammasi, Shuhd Khaled Bin Ajaj, Raghad Ayadh Alharthi, Rouda Ibrahim Mansour, Haneen Ahmed Al-Ghzaly
, All Rights Reserved</p>
          <button onClick={onPrivacyClick} className="privacy-link">
            Privacy Policy
          </button>
        </div>
      </div>
      <div className="footer-line"></div>
    </footer>
  );
}

export default Footer;
