// Sidebar.js
import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaUserPlus, FaClipboardList } from 'react-icons/fa';
import './Sidebar.css'; // <-- make sure you have this CSS (I'll give it to you too)

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-link">
        <Link to="/dashboard">
          <FaHome className="sidebar-icon" />
          <span>Home Page</span>
        </Link>
      </div>
      <div className="sidebar-link">
        <Link to="/">
          <FaUserPlus className="sidebar-icon" />
          <span>New Patient</span>
        </Link>
      </div>
      <div className="sidebar-link">
        <Link to="/records">
          <FaClipboardList className="sidebar-icon" />
          <span>Patient Records</span>
        </Link>
      </div>
    </div>
  );
}

export default Sidebar;
